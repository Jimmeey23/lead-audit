import type { Lead } from "@/data/leads";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const EVIDENCE_BUCKET = "lead-evidence";

export type PersistedAttachment = {
  id?: string;
  name: string;
  type: string;
  size: number;
  storagePath?: string;
  url?: string;
  file?: File;
};

export type LeadResponseState = {
  firstOutreachDate: string;
  firstOutreachMedium: string;
  firstOutreachAttachments: PersistedAttachment[];
  followUps: {
    date: string;
    comment: string;
    attachments: PersistedAttachment[];
  }[];
};

export type AdminResponse = Tables<"lead_responses"> & {
  touchpoints: Array<Tables<"lead_response_touchpoints"> & { files: PersistedAttachment[] }>;
};

type ResponseRow = Tables<"lead_responses"> & {
  lead_response_touchpoints?: Array<
    Tables<"lead_response_touchpoints"> & {
      lead_response_files?: Tables<"lead_response_files">[];
    }
  >;
};

function toInputValue(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 16);
}

function toDatabaseDate(value: string): string | null {
  if (!value) return null;
  return value.length === 16 ? `${value}:00` : value;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

async function signedUrl(storagePath: string): Promise<string | undefined> {
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error) {
    console.error("[Supabase] Could not create signed URL", error);
    return undefined;
  }
  return data.signedUrl;
}

async function attachSignedUrls(
  files: Tables<"lead_response_files">[] = [],
): Promise<PersistedAttachment[]> {
  return Promise.all(
    files.map(async (file) => ({
      id: file.id,
      name: file.file_name,
      type: file.file_type,
      size: file.file_size,
      storagePath: file.storage_path,
      url: await signedUrl(file.storage_path),
    })),
  );
}

function rowToState(row: ResponseRow, fallbackFollowUps: Lead["followUps"]): LeadResponseState {
  const touchpoints = [...(row.lead_response_touchpoints ?? [])].sort(
    (a, b) => a.touchpoint_order - b.touchpoint_order,
  );
  const first = touchpoints.find((t) => t.touchpoint_key === "first_outreach");

  return {
    firstOutreachDate: toInputValue(first?.occurred_at ?? null),
    firstOutreachMedium: first?.medium ?? "WhatsApp",
    firstOutreachAttachments: [],
    followUps: fallbackFollowUps.map((_, index) => {
      const touchpoint = touchpoints.find((t) => t.touchpoint_key === `follow_up_${index + 1}`);
      return {
        date: toInputValue(touchpoint?.occurred_at ?? null),
        comment: touchpoint?.comment ?? "",
        attachments: [],
      };
    }),
  };
}

export async function isCurrentUserAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("active", true)
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] Admin lookup failed", error);
    return false;
  }
  return Boolean(data);
}

export async function loadLeadResponse(lead: Lead): Promise<LeadResponseState | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("lead_responses")
    .select("*, lead_response_touchpoints(*, lead_response_files(*))")
    .eq("lead_id", lead.id)
    .eq("submitted_by", userData.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ResponseRow;
  const state = rowToState(row, lead.followUps);
  const touchpoints = row.lead_response_touchpoints ?? [];

  for (const touchpoint of touchpoints) {
    const attachments = await attachSignedUrls(touchpoint.lead_response_files);
    if (touchpoint.touchpoint_key === "first_outreach") {
      state.firstOutreachAttachments = attachments;
    } else {
      const match = touchpoint.touchpoint_key.match(/^follow_up_(\d+)$/);
      const index = match ? Number(match[1]) - 1 : -1;
      if (index >= 0 && state.followUps[index]) state.followUps[index].attachments = attachments;
    }
  }

  return state;
}

async function uploadAttachment(
  responseId: string,
  touchpointKey: string,
  attachment: PersistedAttachment,
): Promise<PersistedAttachment> {
  if (!attachment.file) return attachment;

  const stamp = `${Date.now()}-${crypto.randomUUID()}`;
  const storagePath = `${responseId}/${touchpointKey}/${stamp}-${sanitizeFileName(attachment.file.name)}`;
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, attachment.file, {
      contentType: attachment.file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;

  return {
    name: attachment.file.name,
    type: attachment.file.type || "application/octet-stream",
    size: attachment.file.size,
    storagePath,
    url: await signedUrl(storagePath),
  };
}

export async function saveLeadResponse(
  lead: Lead,
  state: LeadResponseState,
): Promise<LeadResponseState> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user?.email) throw new Error("You must be signed in to save a response.");

  const { data: response, error: upsertError } = await supabase
    .from("lead_responses")
    .upsert(
      {
        lead_id: lead.id,
        lead_name: lead.fullName,
        lead_email: lead.email === "-" ? null : lead.email,
        lead_phone: lead.phone,
        center: lead.center,
        associate: lead.associate,
        stage_name: lead.stageName,
        class_type: lead.classType,
        source_name: lead.sourceName,
        submitted_by: user.id,
        submitted_by_email: user.email,
        status: "submitted",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_id,submitted_by" },
    )
    .select("id")
    .single();

  if (upsertError) throw upsertError;
  const responseId = response.id;

  const { data: existingFiles } = await supabase
    .from("lead_response_files")
    .select("storage_path")
    .eq("response_id", responseId);

  const firstAttachments = await Promise.all(
    state.firstOutreachAttachments.map((attachment) =>
      uploadAttachment(responseId, "first_outreach", attachment),
    ),
  );
  const followUps = await Promise.all(
    state.followUps.map(async (followUp, index) => ({
      ...followUp,
      attachments: await Promise.all(
        followUp.attachments.map((attachment) =>
          uploadAttachment(responseId, `follow_up_${index + 1}`, attachment),
        ),
      ),
    })),
  );

  const { error: deleteError } = await supabase
    .from("lead_response_touchpoints")
    .delete()
    .eq("response_id", responseId);
  if (deleteError) throw deleteError;

  const touchpoints = [
    {
      response_id: responseId,
      touchpoint_key: "first_outreach",
      touchpoint_order: 0,
      label: "First outreach",
      occurred_at: toDatabaseDate(state.firstOutreachDate),
      medium: state.firstOutreachMedium,
      comment: null,
    },
    ...followUps.map((followUp, index) => ({
      response_id: responseId,
      touchpoint_key: `follow_up_${index + 1}`,
      touchpoint_order: index + 1,
      label: `Follow-up ${index + 1}`,
      occurred_at: toDatabaseDate(followUp.date),
      medium: null,
      comment: followUp.comment || null,
    })),
  ].filter((touchpoint, index) => {
    if (index === 0) return Boolean(touchpoint.occurred_at || firstAttachments.length);
    const followUp = followUps[index - 1];
    return Boolean(touchpoint.occurred_at || touchpoint.comment || followUp.attachments.length);
  });

  const insertedTouchpoints =
    touchpoints.length > 0
      ? await supabase
          .from("lead_response_touchpoints")
          .insert(touchpoints)
          .select("id,touchpoint_key")
      : { data: [], error: null };
  if (insertedTouchpoints.error) throw insertedTouchpoints.error;

  const touchpointIds = new Map(
    (insertedTouchpoints.data ?? []).map((touchpoint) => [
      touchpoint.touchpoint_key,
      touchpoint.id,
    ]),
  );
  const fileRows = [
    ...firstAttachments.map((attachment) => ({ touchpointKey: "first_outreach", attachment })),
    ...followUps.flatMap((followUp, index) =>
      followUp.attachments.map((attachment) => ({
        touchpointKey: `follow_up_${index + 1}`,
        attachment,
      })),
    ),
  ]
    .filter(({ attachment }) => attachment.storagePath)
    .map(({ touchpointKey, attachment }) => ({
      response_id: responseId,
      touchpoint_id: touchpointIds.get(touchpointKey)!,
      uploaded_by: user.id,
      file_name: attachment.name,
      file_type: attachment.type,
      file_size: attachment.size,
      storage_bucket: EVIDENCE_BUCKET,
      storage_path: attachment.storagePath!,
    }))
    .filter((file) => file.touchpoint_id);

  if (fileRows.length > 0) {
    const { error: fileError } = await supabase.from("lead_response_files").insert(fileRows);
    if (fileError) throw fileError;
  }

  const stalePaths = (existingFiles ?? [])
    .map((file) => file.storage_path)
    .filter((path) => !fileRows.some((file) => file.storage_path === path));
  if (stalePaths.length > 0) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove(stalePaths);
  }

  return {
    firstOutreachDate: state.firstOutreachDate,
    firstOutreachMedium: state.firstOutreachMedium,
    firstOutreachAttachments: firstAttachments,
    followUps,
  };
}

export async function loadAdminResponses(): Promise<AdminResponse[]> {
  const { data, error } = await supabase
    .from("lead_responses")
    .select("*, lead_response_touchpoints(*, lead_response_files(*))")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return Promise.all(
    ((data ?? []) as ResponseRow[]).map(async (row) => ({
      ...row,
      touchpoints: await Promise.all(
        [...(row.lead_response_touchpoints ?? [])]
          .sort((a, b) => a.touchpoint_order - b.touchpoint_order)
          .map(async (touchpoint) => ({
            ...touchpoint,
            files: await attachSignedUrls(touchpoint.lead_response_files),
          })),
      ),
    })),
  );
}
