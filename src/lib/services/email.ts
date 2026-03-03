import { ServerClient } from "postmark";
import sgMail from "@sendgrid/mail";
import { assertOutboundAllowed } from "@/lib/services/subscription-gate";
import { logAuditEvent } from "@/lib/services/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const postmarkClient = process.env.POSTMARK_SERVER_TOKEN
  ? new ServerClient(process.env.POSTMARK_SERVER_TOKEN)
  : null;

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

type SendEmailInput = {
  accountId: string;
  leadId?: string | null;
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  actorUserId?: string | null;
  dedupeKey?: string;
};

export async function sendEmail(input: SendEmailInput) {
  await assertOutboundAllowed(input.accountId);

  const from = process.env.FROM_EMAIL;
  if (!from) throw new Error("FROM_EMAIL missing");

  const supabase = getSupabaseAdminClient();

  if (input.dedupeKey) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id, provider_message_id")
      .eq("account_id", input.accountId)
      .eq("channel", "EMAIL")
      .eq("direction", "OUTBOUND")
      .eq("metadata->>dedupe_key", input.dedupeKey)
      .maybeSingle();

    if (existing) {
      return { id: existing.id as string, providerId: String(existing.provider_message_id || "existing") };
    }
  }

  let providerMessageId = "";

  if (postmarkClient) {
    const res = await postmarkClient.sendEmail({
      From: from,
      To: input.to,
      Subject: input.subject,
      HtmlBody: input.htmlBody,
      TextBody: input.textBody
    });
    providerMessageId = String(res.MessageID);
  } else if (process.env.SENDGRID_API_KEY) {
    const [res] = await sgMail.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.htmlBody,
      text: input.textBody
    });
    providerMessageId = String(res.headers["x-message-id"] || "sendgrid-no-id");
  } else {
    throw new Error("No email provider configured");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      account_id: input.accountId,
      lead_id: input.leadId ?? null,
      channel: "EMAIL",
      direction: "OUTBOUND",
      body: input.htmlBody,
      to_email: input.to,
      from_email: from,
      subject: input.subject,
      provider_message_id: providerMessageId,
      status: "sent",
      metadata: input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAuditEvent({
    accountId: input.accountId,
    actorUserId: input.actorUserId,
    eventType: "outbound_email_sent",
    entityType: "message",
    entityId: data.id,
    metadata: { providerId: providerMessageId }
  });

  return { id: data.id, providerId: providerMessageId };
}
