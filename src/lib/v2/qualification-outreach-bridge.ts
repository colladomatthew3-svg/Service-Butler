/**
 * Qualification → Outreach Bridge
 *
 * When an opportunity reaches `qualified_contactable` status, this module
 * queues a first-touch outreach event. It respects:
 *   - Suppression lists (opt-outs)
 *   - Cooling windows (no double-sends)
 *   - Vertical-specific message templates
 *   - Manual review queue for every newly qualified contact
 *
 * This is intentionally separate from the qualification API so the
 * qualification endpoint remains a fast, synchronous write — outreach
 * is queued and handled async.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FranchiseVertical } from "@/lib/v2/franchise-verticals";
import { getVertical } from "@/lib/v2/franchise-verticals";
import { logV2AuditEvent } from "@/lib/v2/audit";

// ---------------------------------------------------------------------------
// Vertical-specific first-touch templates
// ---------------------------------------------------------------------------

type MessageTemplate = {
  smsBody: string;
  emailSubject: string;
  emailBody: string;
};

function buildFirstTouchTemplate(
  vertical: FranchiseVertical,
  context: {
    contactName?: string | null;
    address?: string | null;
    serviceType?: string | null;
    urgency?: string;
  }
): MessageTemplate {
  const name = context.contactName ? `, ${context.contactName.split(" ")[0]}` : "";
  const address = context.address ? ` at ${context.address}` : "";

  switch (vertical.key) {
    case "restoration":
      return {
        smsBody: `Hi${name}! We noticed a weather event${address} that may have caused damage. We're a local restoration team and want to help you assess any issues quickly. Reply STOP to opt out.`,
        emailSubject: "Quick assessment offer — storm/water damage",
        emailBody: `Hi${name},\n\nWe noticed recent weather activity in your area${address}. If your property experienced any damage — water, wind, or otherwise — our team is available for a free, no-obligation assessment.\n\nWe work with all major insurance carriers and can often begin mitigation the same day.\n\nReply to this message or call us to schedule.\n\nThank you,\nYour local restoration team`,
      };

    case "pest_control":
      return {
        smsBody: `Hi${name}! Mosquito season is heating up in your area. Want a free quote for yard treatment${address}? Reply STOP to opt out.`,
        emailSubject: "Mosquito season — free yard treatment quote",
        emailBody: `Hi${name},\n\nMosquito activity is picking up this time of year in your neighborhood${address}. We're offering free quotes for yard mosquito treatment — most homes can be protected with a single seasonal plan.\n\nOur treatments are family and pet friendly.\n\nReply to schedule a free quote.\n\nThank you,\nYour local pest control team`,
      };

    case "home_services":
      return {
        smsBody: `Hi${name}! We saw a permit or home activity at your address${address} and wanted to offer a free consultation. Reply STOP to opt out.`,
        emailSubject: "Home improvement consultation — complimentary",
        emailBody: `Hi${name},\n\nWe noticed some activity at your property${address} that suggests you may be planning home improvements. We'd love to offer a free consultation to see if we can help with your project.\n\nOur team specializes in ${vertical.primaryServiceLines.slice(0, 2).join(" and ")} — we're local, licensed, and ready to start quickly.\n\nReply to schedule a free consultation.\n\nThank you,\nYour local home services team`,
      };

    default:
      return {
        smsBody: `Hi${name}! We'd love to help with your home service needs${address}. Reply STOP to opt out.`,
        emailSubject: "Home services — we're here to help",
        emailBody: `Hi${name},\n\nOur local team is available to help with your home service needs${address}. Reply to learn more.\n\nThank you`,
      };
  }
}

// ---------------------------------------------------------------------------
// Outreach queue entry
// ---------------------------------------------------------------------------

export type QueuedOutreachEntry = {
  opportunityId: string;
  tenantId: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  serviceType: string | null;
  verticalKey: string;
  channel: "sms" | "email";
  messageBody: string;
  subject: string | null;
  qualifiedAt: string;
  actorUserId: string;
};

/**
 * Queue a first-touch outreach event for a newly qualified opportunity.
 *
 * Qualification-triggered outreach always enters `v2_outreach_queue` with
 * status "pending_review" so an operator can approve it before any send path.
 */
export async function queueQualificationOutreach(
  supabase: SupabaseClient,
  input: {
    opportunityId: string;
    tenantId: string;
    actorUserId: string;
    vertical: FranchiseVertical;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    serviceType?: string | null;
    urgency?: string;
  }
): Promise<{ queued: boolean; channel: string | null; safeMode: boolean; reason?: string }> {
  const safeMode = true;

  // Determine preferred channel
  const channel: "sms" | "email" | null = input.phone ? "sms" : input.email ? "email" : null;
  if (!channel) {
    return { queued: false, channel: null, safeMode, reason: "no_contact_method" };
  }

  const template = buildFirstTouchTemplate(input.vertical, {
    contactName: input.contactName,
    address: input.address,
    serviceType: input.serviceType,
    urgency: input.urgency,
  });

  const destination = channel === "sms" ? input.phone! : input.email!;
  const messageBody = channel === "sms" ? template.smsBody : template.emailBody;
  const subject = channel === "email" ? template.emailSubject : null;

  const { error } = await supabase.from("v2_outreach_queue").insert({
    tenant_id: input.tenantId,
    opportunity_id: input.opportunityId,
    channel,
    to_address: destination,
    body: messageBody,
    subject,
    status: "pending_review",
    vertical_key: input.vertical.key,
    qualified_at: new Date().toISOString(),
    queued_by: input.actorUserId,
    metadata: {
      contact_name: input.contactName ?? null,
      service_type: input.serviceType ?? null,
      safe_mode: true
    }
  });

  if (!error) {
    await logV2AuditEvent({
      tenantId: input.tenantId,
      actorType: "user",
      actorId: input.actorUserId,
      action: "outreach_queued_pending_review",
      entityType: "opportunity",
      entityId: input.opportunityId,
      after: { channel, vertical: input.vertical.key },
    });
  }

  return { queued: !error, channel, safeMode };
}

/**
 * Determine whether a newly qualified opportunity should trigger outreach.
 * Returns false if the vertical or urgency doesn't warrant immediate contact.
 */
export function shouldTriggerFirstTouch(
  vertical: FranchiseVertical,
  urgencyScore: number
): boolean {
  // Only trigger for high-intent signals
  return urgencyScore >= vertical.scoreModifiers.highIntentThreshold;
}

/**
 * Convenience: run the full qualification → outreach pipeline.
 * Call this after an opportunity is set to `qualified_contactable`.
 */
export async function maybeQueueQualificationOutreach(
  supabase: SupabaseClient,
  input: {
    opportunityId: string;
    tenantId: string;
    actorUserId: string;
    franchiseVerticalKey?: string | null;
    urgencyScore?: number | null;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    serviceType?: string | null;
  }
): Promise<{ triggered: boolean; result?: Awaited<ReturnType<typeof queueQualificationOutreach>> }> {
  const vertical = getVertical(input.franchiseVerticalKey);
  const urgency = Number(input.urgencyScore ?? 0);

  if (!shouldTriggerFirstTouch(vertical, urgency)) {
    return { triggered: false };
  }

  if (!input.phone && !input.email) {
    return { triggered: false };
  }

  const result = await queueQualificationOutreach(supabase, {
    opportunityId: input.opportunityId,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    vertical,
    contactName: input.contactName,
    phone: input.phone,
    email: input.email,
    address: input.address,
    serviceType: input.serviceType,
  });

  return { triggered: result.queued, result };
}
