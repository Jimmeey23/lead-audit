import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const ADMIN_EMAIL = "jimmeey@physique57india.com";

const resetInput = z.object({
  responseId: z.string().uuid(),
  reason: z.string().trim().min(8, "Please enter a clear rejection reason."),
  accessToken: z.string().min(1),
});

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

function supabaseForToken(accessToken: string) {
  return createClient<Database>(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendRejectionEmail({
  to,
  leadName,
  leadId,
  reason,
}: {
  to: string;
  leadName: string;
  leadId: string;
  reason: string;
}) {
  const fromEmail = env("MAILTRAP_FROM_EMAIL");
  const fromName = process.env.MAILTRAP_FROM_NAME || "Physique 57 Outreach Audit";
  const token = env("MAILTRAP_API_TOKEN");
  const escapedLeadName = escapeHtml(leadName);
  const escapedLeadId = escapeHtml(leadId);
  const escapedReason = escapeHtml(reason).replace(/\n/g, "<br />");
  const subject = `Action required: Outreach audit row reset for ${leadName}`;
  const text = [
    "Hello,",
    "",
    `Your submitted outreach audit row for ${leadName} (${leadId}) has been reviewed and reset by the admin team.`,
    "The row is now back in your audit ledger as a draft, so you can update it and submit it again. Any details already saved against the row, including comments, touchpoints, and supporting documents, have been retained.",
    "",
    "Reason for rejection:",
    reason,
    "",
    "Next steps:",
    "1. Open the outreach audit ledger and locate this lead.",
    "2. Review the rejection reason above and update the relevant outreach or follow-up fields.",
    "3. Check that the date, medium, comments, and supporting documents are complete and accurate.",
    "4. If supporting documents are not available, switch on the unavailable-document option and enter a clear reason.",
    "5. Submit the row again once all required fields are complete.",
    "",
    "Please complete the corrections as soon as possible so the admin team can review the updated entry.",
    "",
    "Regards,",
    "Physique 57 Outreach Audit Team",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.55;">
      <p>Hello,</p>
      <p>
        Your submitted outreach audit row for
        <strong>${escapedLeadName}</strong> (${escapedLeadId}) has been reviewed and reset by the admin team.
      </p>
      <p>
        The row is now back in your audit ledger as a draft, so you can update it and submit it again.
        Any details already saved against the row, including comments, touchpoints, and supporting documents, have been retained.
      </p>
      <div style="margin: 18px 0; padding: 14px 16px; border-left: 4px solid #2563eb; background: #eff6ff;">
        <p style="margin: 0 0 8px; font-weight: 700;">Reason for rejection</p>
        <p style="margin: 0;">${escapedReason}</p>
      </div>
      <p style="font-weight: 700;">Next steps</p>
      <ol style="padding-left: 22px;">
        <li>Open the outreach audit ledger and locate this lead.</li>
        <li>Review the rejection reason above and update the relevant outreach or follow-up fields.</li>
        <li>Check that the date, medium, comments, and supporting documents are complete and accurate.</li>
        <li>If supporting documents are not available, switch on the unavailable-document option and enter a clear reason.</li>
        <li>Submit the row again once all required fields are complete.</li>
      </ol>
      <p>Please complete the corrections as soon as possible so the admin team can review the updated entry.</p>
      <p>Regards,<br />Physique 57 Outreach Audit Team</p>
    </div>
  `;

  const response = await fetch("https://send.api.mailtrap.io/api/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: fromName },
      to: [{ email: to }],
      subject,
      text,
      html,
      category: "lead-audit-reset",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Mailtrap email failed (${response.status}). ${body}`);
  }
}

export const resetLeadResponseWithNotification = createServerFn({ method: "POST" })
  .inputValidator(resetInput)
  .handler(async ({ data }) => {
    const supabase = supabaseForToken(data.accessToken);
    const { data: userData, error: userError } = await supabase.auth.getUser(data.accessToken);
    if (userError || userData.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error("Admin access required.");
    }

    const { data: response, error: responseError } = await supabase
      .from("lead_responses")
      .select("id, lead_id, lead_name, submitted_by_email")
      .eq("id", data.responseId)
      .single();
    if (responseError || !response) throw new Error("Response could not be loaded for reset.");

    await sendRejectionEmail({
      to: response.submitted_by_email,
      leadName: response.lead_name,
      leadId: response.lead_id,
      reason: data.reason,
    });

    const { error: resetError } = await supabase
      .from("lead_responses")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", data.responseId);
    if (resetError) throw new Error("Response could not be reset.");

    return { ok: true };
  });
