import type { Lead } from "@/data/leads";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const EVIDENCE_BUCKET = "lead-evidence";
export const ADMIN_EMAIL = "jimmeey@physique57india.com";
export const MAX_PROOF_FILE_SIZE_BYTES = 200 * 1024 * 1024;

export type PersistedAttachment = {
  id?: string;
  name: string;
  type: string;
  size: number;
  storagePath?: string;
  url?: string;
  file?: File;
};

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export type LeadResponseState = {
  responseNotes: string;
  firstOutreachDate: string;
  firstOutreachMedium: string;
  firstOutreachComment: string;
  firstOutreachEvidenceUnavailable: boolean;
  firstOutreachEvidenceReason: string;
  firstOutreachAttachments: PersistedAttachment[];
  followUps: {
    date: string;
    medium: string;
    comment: string;
    evidenceUnavailable: boolean;
    evidenceReason: string;
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

export function timelineTimestamp(value: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function supabaseErrorMessage(context: string, error: unknown): string {
  if (!error || typeof error !== "object") return context;
  const details = error as { message?: string; details?: string; hint?: string; code?: string };
  return [
    context,
    details.message,
    details.details,
    details.hint ? `Hint: ${details.hint}` : null,
    details.code ? `Code: ${details.code}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function networkErrorMessage(context: string, error: unknown): string {
  if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
    return `${context} Network request failed. This is usually caused by a large file upload, an interrupted connection, or Supabase Storage rejecting the request before it returns a detailed error. Try submitting once without files, then upload smaller supporting documents.`;
  }
  return supabaseErrorMessage(context, error);
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
    responseNotes: row.response_notes ?? "",
    firstOutreachDate: toInputValue(first?.occurred_at ?? null),
    firstOutreachMedium: first?.medium ?? "WhatsApp",
    firstOutreachComment: first?.comment ?? "",
    firstOutreachEvidenceUnavailable: first?.evidence_unavailable ?? false,
    firstOutreachEvidenceReason: first?.evidence_unavailable_reason ?? "",
    firstOutreachAttachments: [],
    followUps: fallbackFollowUps.map((_, index) => {
      const touchpoint = touchpoints.find((t) => t.touchpoint_key === `follow_up_${index + 1}`);
      return {
        date: toInputValue(touchpoint?.occurred_at ?? null),
        medium: touchpoint?.medium ?? "WhatsApp",
        comment: touchpoint?.comment ?? "",
        evidenceUnavailable: touchpoint?.evidence_unavailable ?? false,
        evidenceReason: touchpoint?.evidence_unavailable_reason ?? "",
        attachments: [],
      };
    }),
  };
}

export async function isCurrentUserAdmin(email: string | null | undefined): Promise<boolean> {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
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

export async function loadSubmittedLeadIds(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("submitted_lead_ids");
  if (error) throw error;
  return new Set((data ?? []).map((response) => response.lead_id));
}

async function uploadAttachment(
  responseId: string,
  touchpointKey: string,
  attachment: PersistedAttachment,
): Promise<PersistedAttachment> {
  if (!attachment.file) return attachment;
  if (attachment.file.size > MAX_PROOF_FILE_SIZE_BYTES) {
    throw new Error(
      `${attachment.file.name} is ${formatFileSize(attachment.file.size)}. Maximum supporting document file size is ${formatFileSize(MAX_PROOF_FILE_SIZE_BYTES)}.`,
    );
  }

  const stamp = `${Date.now()}-${crypto.randomUUID()}`;
  const storagePath = `${responseId}/${touchpointKey}/${stamp}-${sanitizeFileName(attachment.file.name)}`;
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, attachment.file, {
      contentType: attachment.file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) {
    throw new Error(
      supabaseErrorMessage(
        `Supporting document "${attachment.file.name}" could not be uploaded.`,
        error,
      ),
    );
  }

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
        response_notes: state.responseNotes || null,
        submitted_by: user.id,
        submitted_by_email: user.email,
        status: "draft",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_id,submitted_by" },
    )
    .select("id")
    .single();

  if (upsertError)
    throw new Error(supabaseErrorMessage("Response could not be saved.", upsertError));
  const responseId = response.id;

  const { data: existingFiles } = await supabase
    .from("lead_response_files")
    .select("storage_path")
    .eq("response_id", responseId);

  const firstAttachments = await Promise.all(
    state.firstOutreachAttachments.map((attachment) =>
      uploadAttachment(responseId, "first_outreach", attachment).catch((error) => {
        throw new Error(
          networkErrorMessage(
            `Supporting document "${attachment.name}" could not be uploaded.`,
            error,
          ),
        );
      }),
    ),
  );
  const followUps = await Promise.all(
    state.followUps.map(async (followUp, index) => ({
      ...followUp,
      attachments: await Promise.all(
        followUp.attachments.map((attachment) =>
          uploadAttachment(responseId, `follow_up_${index + 1}`, attachment).catch((error) => {
            throw new Error(
              networkErrorMessage(
                `Supporting document "${attachment.name}" could not be uploaded.`,
                error,
              ),
            );
          }),
        ),
      ),
    })),
  );

  const { error: deleteError } = await supabase
    .from("lead_response_touchpoints")
    .delete()
    .eq("response_id", responseId);
  if (deleteError)
    throw new Error(
      supabaseErrorMessage("Existing touchpoints could not be replaced.", deleteError),
    );

  const touchpoints = [
    {
      response_id: responseId,
      touchpoint_key: "first_outreach",
      touchpoint_order: 0,
      label: "First outreach",
      occurred_at: toDatabaseDate(state.firstOutreachDate),
      medium: state.firstOutreachMedium,
      comment: state.firstOutreachComment || null,
      evidence_unavailable: state.firstOutreachEvidenceUnavailable,
      evidence_unavailable_reason: state.firstOutreachEvidenceReason || null,
    },
    ...followUps.map((followUp, index) => ({
      response_id: responseId,
      touchpoint_key: `follow_up_${index + 1}`,
      touchpoint_order: index + 1,
      label: `Follow-up ${index + 1}`,
      occurred_at: toDatabaseDate(followUp.date),
      medium: followUp.medium,
      comment: followUp.comment || null,
      evidence_unavailable: followUp.evidenceUnavailable,
      evidence_unavailable_reason: followUp.evidenceReason || null,
    })),
  ].filter((touchpoint, index) => {
    if (index === 0)
      return Boolean(
        touchpoint.occurred_at ||
        touchpoint.comment ||
        touchpoint.evidence_unavailable ||
        firstAttachments.length,
      );
    const followUp = followUps[index - 1];
    return Boolean(
      touchpoint.occurred_at ||
      touchpoint.comment ||
      touchpoint.evidence_unavailable ||
      followUp.attachments.length,
    );
  });

  const insertedTouchpoints =
    touchpoints.length > 0
      ? await supabase
          .from("lead_response_touchpoints")
          .insert(touchpoints)
          .select("id,touchpoint_key")
      : { data: [], error: null };
  if (insertedTouchpoints.error)
    throw new Error(
      supabaseErrorMessage("Touchpoints could not be saved.", insertedTouchpoints.error),
    );

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
    if (fileError)
      throw new Error(supabaseErrorMessage("Supporting documents could not be saved.", fileError));
  }

  const stalePaths = (existingFiles ?? [])
    .map((file) => file.storage_path)
    .filter((path) => !fileRows.some((file) => file.storage_path === path));
  if (stalePaths.length > 0) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove(stalePaths);
  }

  const { error: submitError } = await supabase
    .from("lead_responses")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", responseId);
  if (submitError)
    throw new Error(
      supabaseErrorMessage("Response could not be marked as submitted.", submitError),
    );

  return {
    responseNotes: state.responseNotes,
    firstOutreachDate: state.firstOutreachDate,
    firstOutreachMedium: state.firstOutreachMedium,
    firstOutreachComment: state.firstOutreachComment,
    firstOutreachEvidenceUnavailable: state.firstOutreachEvidenceUnavailable,
    firstOutreachEvidenceReason: state.firstOutreachEvidenceReason,
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

export async function resetLeadResponse(responseId: string): Promise<void> {
  const { data: files, error: fileLoadError } = await supabase
    .from("lead_response_files")
    .select("storage_path")
    .eq("response_id", responseId);

  if (fileLoadError)
    throw new Error(
      supabaseErrorMessage("Supporting documents could not be loaded for reset.", fileLoadError),
    );

  const storagePaths = (files ?? []).map((file) => file.storage_path).filter(Boolean);
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .remove(storagePaths);
    if (storageError)
      throw new Error(
        supabaseErrorMessage("Supporting documents could not be removed.", storageError),
      );
  }

  const { error } = await supabase.from("lead_responses").delete().eq("id", responseId);

  if (error) throw new Error(supabaseErrorMessage("Response could not be reset.", error));
}
