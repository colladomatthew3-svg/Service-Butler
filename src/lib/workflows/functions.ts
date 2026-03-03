import { inngest } from "@/lib/workflows/client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/services/sms";
import { sendEmail } from "@/lib/services/email";
import { enrollLeadInSequence } from "@/lib/services/sequence";
import { logAuditEvent } from "@/lib/services/audit";
import { logEvent } from "@/lib/services/logger";

async function getLeadContact(accountId: string, leadId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("leads")
    .select("id, stage, stop_all_sequences, contacts:contact_id(phone_e164,email)")
    .eq("account_id", accountId)
    .eq("id", leadId)
    .single();

  return data as
    | {
        id: string;
        stage: string;
        stop_all_sequences: boolean;
        contacts: { phone_e164?: string | null; email?: string | null } | { phone_e164?: string | null; email?: string | null }[];
      }
    | null;
}

async function shouldStopSequence(accountId: string, leadId: string, initialStage?: string) {
  const supabase = getSupabaseAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("stage, stop_all_sequences")
    .eq("account_id", accountId)
    .eq("id", leadId)
    .single();

  if (!lead || lead.stop_all_sequences) return true;
  if (initialStage && lead.stage !== initialStage) return true;

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("lead_id", leadId)
    .eq("direction", "INBOUND");

  return (count || 0) > 0;
}

function inQuietHours(start: string | null, end: string | null, now = new Date()) {
  if (!start || !end) return false;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  if (startMinutes <= endMinutes) return minutesNow >= startMinutes && minutesNow < endMinutes;
  return minutesNow >= startMinutes || minutesNow < endMinutes;
}

export const missedCallFollowup = inngest.createFunction(
  { id: "missed_call_followup" },
  { event: "call/missed" },
  async ({ event, step }) => {
    const { accountId, leadId, callSid } = event.data as { accountId: string; leadId: string; callSid?: string };

    await step.run("enroll-missed-call-sequence", async () => {
      await enrollLeadInSequence(accountId, leadId, "MISSED_CALL_FOLLOWUP");
    });

    const lead = await step.run("load-lead", async () => getLeadContact(accountId, leadId));
    if (!lead) return { ok: false };

    const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts;
    if (!contact?.phone_e164) return { ok: false };

    await step.run("send-initial-missed-call-sms", async () => {
      await sendSms({
        accountId,
        leadId,
        to: contact.phone_e164!,
        body: "Sorry we missed your call. Reply here and we can help right away.",
        dedupeKey: `missed-call:${callSid || leadId}:step1`
      });
    });

    await step.sleep("wait-30m", "30m");

    const stop = await step.run("check-stop-conditions", async () => shouldStopSequence(accountId, leadId, lead.stage));
    if (stop) return { ok: true, stopped: true };

    await step.run("send-second-missed-call-sms", async () => {
      await sendSms({
        accountId,
        leadId,
        to: contact.phone_e164!,
        body: "Quick follow-up: want to schedule service? Reply YES and we will lock a time.",
        dedupeKey: `missed-call:${callSid || leadId}:step2`
      });
    });

    return { ok: true };
  }
);

export const newLeadFollowup = inngest.createFunction(
  { id: "new_lead_followup" },
  { event: "lead/created" },
  async ({ event, step }) => {
    const { accountId, leadId } = event.data as { accountId: string; leadId: string };

    await step.run("enroll-new-lead-sequence", async () => {
      await enrollLeadInSequence(accountId, leadId, "NEW_LEAD_FOLLOWUP");
    });

    const lead = await step.run("load-lead", async () => getLeadContact(accountId, leadId));
    if (!lead) return { ok: false };
    const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts;

    if (contact?.phone_e164) {
      await step.run("send-new-lead-sms", async () => {
        await sendSms({
          accountId,
          leadId,
          to: contact.phone_e164!,
          body: "Thanks for reaching out. We can help. Reply with your preferred appointment window.",
          dedupeKey: `new-lead:${leadId}:sms1`
        });
      });
    }

    if (contact?.email) {
      await step.run("send-new-lead-email", async () => {
        await sendEmail({
          accountId,
          leadId,
          to: contact.email!,
          subject: "We got your request",
          htmlBody: "<p>Thanks for contacting us. Reply with the best time for service.</p>",
          textBody: "Thanks for contacting us. Reply with the best time for service.",
          dedupeKey: `new-lead:${leadId}:email1`
        });
      });
    }

    await step.sleep("wait-4h", "4h");
    const stop = await step.run("check-stop-conditions", async () => shouldStopSequence(accountId, leadId, lead.stage));
    if (stop || !contact?.phone_e164) return { ok: true, stopped: true };

    await step.run("send-followup-sms", async () => {
      await sendSms({
        accountId,
        leadId,
        to: contact.phone_e164!,
        body: "Following up in case you still need help. Reply anytime and we will get you booked.",
        dedupeKey: `new-lead:${leadId}:sms2`
      });
    });

    return { ok: true };
  }
);

export const reviewRequest = inngest.createFunction(
  { id: "review_request" },
  { event: "job/completed" },
  async ({ event, step }) => {
    const { accountId, leadId } = event.data as { accountId: string; leadId: string };

    await step.run("enroll-review-sequence", async () => {
      await enrollLeadInSequence(accountId, leadId, "REVIEW_REQUEST");
    });

    const supabase = getSupabaseAdminClient();
    const lead = await step.run("load-lead", async () => getLeadContact(accountId, leadId));
    if (!lead) return { ok: false };

    const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts;
    const { data: settings } = await supabase
      .from("account_settings")
      .select("review_link")
      .eq("account_id", accountId)
      .single();

    if (contact?.phone_e164 && settings?.review_link) {
      await step.run("send-review-request", async () => {
        await sendSms({
          accountId,
          leadId,
          to: contact.phone_e164!,
          body: `Thanks for choosing us. Mind leaving a quick review? ${settings.review_link}`,
          dedupeKey: `review:${leadId}:sms1`
        });
      });
    }

    await step.sleep("wait-review-response", "24h");

    await step.run("route-low-rating-internal", async () => {
      const { data: inbound } = await supabase
        .from("messages")
        .select("body")
        .eq("account_id", accountId)
        .eq("lead_id", leadId)
        .eq("direction", "INBOUND")
        .order("created_at", { ascending: false })
        .limit(5);

      const lowRating = (inbound || []).some((m) => /\b[1-3]\b/.test(m.body || ""));
      if (lowRating) {
        await logAuditEvent({
          accountId,
          eventType: "low_rating_routed_internal",
          entityType: "lead",
          entityId: leadId
        });
      }
    });

    return { ok: true };
  }
);

export const campaignDispatch = inngest.createFunction(
  { id: "campaign_dispatch" },
  { event: "campaign/send" },
  async ({ event, step }) => {
    const { accountId, campaignId, actorUserId } = event.data as {
      accountId: string;
      campaignId: string;
      actorUserId: string;
    };

    const supabase = getSupabaseAdminClient();
    const campaign = await step.run("load-campaign", async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id,name,channel,message_subject,message_body,segment_filter")
        .eq("id", campaignId)
        .eq("account_id", accountId)
        .single();
      return data;
    });

    if (!campaign) return { ok: false };

    await step.run("mark-sending", async () => {
      await supabase.from("campaigns").update({ status: "SENDING" }).eq("id", campaign.id);
    });

    const settings = await step.run("load-settings", async () => {
      const { data } = await supabase
        .from("account_settings")
        .select("quiet_hours_start,quiet_hours_end")
        .eq("account_id", accountId)
        .maybeSingle();
      return data;
    });

    const leads = await step.run("load-segment", async () => {
      const targetStage = String((campaign.segment_filter as { stage?: string })?.stage || "NEW");
      const { data } = await supabase
        .from("leads")
        .select("id, contacts:contact_id(id,phone_e164,email,opted_out_sms,opted_out_email)")
        .eq("account_id", accountId)
        .eq("stage", targetStage);
      return data || [];
    });

    logEvent("info", "workflow.triggered", { name: "campaign/send", accountId, campaignId, recipients: leads.length });

    for (const lead of leads) {
      const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts;
      if (!contact) continue;

      const quietNow = inQuietHours(settings?.quiet_hours_start || null, settings?.quiet_hours_end || null);
      if (quietNow) {
        await supabase.from("campaign_deliveries").upsert(
          {
            account_id: accountId,
            campaign_id: campaign.id,
            lead_id: lead.id,
            contact_id: contact.id,
            channel: campaign.channel,
            status: "SKIPPED_QUIET_HOURS",
            attempted_at: new Date().toISOString()
          },
          { onConflict: "campaign_id,lead_id,contact_id" }
        );
        continue;
      }

      try {
        if (campaign.channel === "SMS" && contact.phone_e164 && !contact.opted_out_sms) {
          const sms = await step.run(`send-sms-${lead.id}`, async () =>
            sendSms({
              accountId,
              leadId: lead.id,
              to: contact.phone_e164,
              body: campaign.message_body,
              actorUserId,
              dedupeKey: `campaign:${campaign.id}:lead:${lead.id}:sms`
            })
          );
          await supabase.from("campaign_deliveries").upsert(
            {
              account_id: accountId,
              campaign_id: campaign.id,
              lead_id: lead.id,
              contact_id: contact.id,
              channel: "SMS",
              status: "SENT",
              provider_message_id: sms.providerId,
              attempted_at: new Date().toISOString()
            },
            { onConflict: "campaign_id,lead_id,contact_id" }
          );
        }

        if (campaign.channel === "EMAIL" && contact.email && !contact.opted_out_email) {
          const email = await step.run(`send-email-${lead.id}`, async () =>
            sendEmail({
              accountId,
              leadId: lead.id,
              to: contact.email,
              subject: campaign.message_subject || campaign.name,
              htmlBody: campaign.message_body,
              textBody: campaign.message_body,
              actorUserId,
              dedupeKey: `campaign:${campaign.id}:lead:${lead.id}:email`
            })
          );
          await supabase.from("campaign_deliveries").upsert(
            {
              account_id: accountId,
              campaign_id: campaign.id,
              lead_id: lead.id,
              contact_id: contact.id,
              channel: "EMAIL",
              status: "SENT",
              provider_message_id: email.providerId,
              attempted_at: new Date().toISOString()
            },
            { onConflict: "campaign_id,lead_id,contact_id" }
          );
        }
      } catch {
        await supabase.from("campaign_deliveries").upsert(
          {
            account_id: accountId,
            campaign_id: campaign.id,
            lead_id: lead.id,
            contact_id: contact.id,
            channel: campaign.channel,
            status: "FAILED",
            attempted_at: new Date().toISOString()
          },
          { onConflict: "campaign_id,lead_id,contact_id" }
        );
      }
    }

    await step.run("mark-sent", async () => {
      await supabase.from("campaigns").update({ status: "SENT" }).eq("id", campaign.id);
    });

    return { ok: true };
  }
);
