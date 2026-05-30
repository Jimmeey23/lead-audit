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
  const subject = `Outreach audit row reset: ${leadName}`;
  const text = [
    `Your submitted outreach audit row for ${leadName} (${leadId}) has been reset by the admin team.`,
    "",
    "Reason for rejection:",
    reason,
    "",
    "Please review the lead in the audit ledger, correct the entry, attach the required supporting documents or provide the required unavailable-document reason, and submit it again.",
  ].join("\n");
  const html = `
    <p>Your submitted outreach audit row for <strong>${leadName}</strong> (${leadId}) has been reset by the admin team.</p>
    <p><strong>Reason for rejection:</strong></p>
    <p>${reason.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</p>
    <p>Please review the lead in the audit ledger, correct the entry, attach the required supporting documents or provide the required unavailable-document reason, and submit it again.</p>
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
