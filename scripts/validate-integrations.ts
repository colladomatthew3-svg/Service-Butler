import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendTwilioMessage } from "../src/lib/v2/twilio";
import { createHubSpotTask, validateHubSpotAccess } from "../src/lib/v2/hubspot";

type Status = "PASS" | "WARN" | "FAIL";

type ValidationRow = {
  check: string;
  status: Status;
  detail: string;
  remediation?: string;
};

function envTrue(name: string) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function shouldUseSafeMode(name: "SB_TWILIO_SAFE_MODE" | "SB_HUBSPOT_SAFE_MODE") {
  if (!(name in process.env)) return true;
  return envTrue(name);
}

async function resolveTenantId(supabase: any) {
  const explicit = String(process.env.OPERATOR_TENANT_ID || "").trim();
  if (explicit) return explicit;

  const operatorTenantName = String(process.env.OPERATOR_TENANT_NAME || "NY Restoration Group").trim();
  const { data, error } = await supabase
    .from("v2_tenants")
    .select("id")
    .eq("name", operatorTenantName)
    .eq("type", "franchise")
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(`Operator tenant not found (${operatorTenantName}). Run npm run operator:seed.`);
  }

  return String(data.id);
}

async function ensureValidationEntities({ supabase, tenantId }: { supabase: any; tenantId: string }) {
  const now = Date.now();
  const opportunityId = randomUUID();
  const leadId = randomUUID();
  const assignmentId = randomUUID();

  const { error: opportunityError } = await supabase.from("v2_opportunities").insert({
    id: opportunityId,
    tenant_id: tenantId,
    opportunity_type: "integration_validation",
    service_line: "restoration",
    title: "Integration validation opportunity",
    description: "Synthetic opportunity for integration validation",
    urgency_score: 55,
    job_likelihood_score: 65,
    contactability_score: 60,
    source_reliability_score: 70,
    revenue_band: "medium",
    catastrophe_linkage_score: 20,
    location_text: "350 5th Ave, New York, NY 10118",
    postal_code: "10001",
    contact_status: "identified",
    routing_status: "routed",
    lifecycle_status: "assigned",
    explainability_json: { integration_validation: true, ts: now }
  });

  if (opportunityError) throw new Error(opportunityError.message);

  const { error: assignmentError } = await supabase.from("v2_assignments").insert({
    id: assignmentId,
    tenant_id: tenantId,
    opportunity_id: opportunityId,
    assigned_tenant_id: tenantId,
    assignment_reason: "integration_validation",
    status: "accepted",
    assigned_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
    metadata: { integration_validation: true }
  });

  if (assignmentError) throw new Error(assignmentError.message);

  const { error: leadError } = await supabase.from("v2_leads").insert({
    id: leadId,
    tenant_id: tenantId,
    opportunity_id: opportunityId,
    contact_name: "Integration Test Contact",
    contact_channels_json: {
      phone: String(process.env.TWILIO_TEST_TO || "+15005550006"),
      email: "integration-test@example.com"
    },
    property_address: "350 5th Ave, New York, NY 10118",
    city: "New York",
    state: "NY",
    postal_code: "10001",
    lead_status: "qualified",
    crm_sync_status: "not_synced",
    do_not_contact: false
  });

  if (leadError) throw new Error(leadError.message);

  return { opportunityId, assignmentId, leadId };
}

async function insertOutreachEvent({
  supabase,
  tenantId,
  leadId,
  assignmentId,
  channel,
  outcome,
  providerMessageId,
  metadata
}: {
  supabase: any;
  tenantId: string;
  leadId: string;
  assignmentId: string;
  channel: "sms" | "crm_task";
  outcome: string;
  providerMessageId: string | null;
  metadata?: Record<string, unknown>;
}) {
  await supabase.from("v2_outreach_events").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    assignment_id: assignmentId,
    channel,
    event_type: "sent",
    sent_at: new Date().toISOString(),
    outcome,
    provider_message_id: providerMessageId,
    metadata: {
      integration_validation: true,
      ...(metadata || {})
    }
  });
}

async function main() {
  const results: ValidationRow[] = [];

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !serviceRole) {
    console.log("[validate-integrations] mode=simulated (missing Supabase credentials)");
    console.log("Twilio and HubSpot validations skipped.");
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  }) as any;

  const tenantId = await resolveTenantId(supabase);
  const { leadId, opportunityId, assignmentId } = await ensureValidationEntities({
    supabase,
    tenantId
  });

  const twilioDisabled = envTrue("SB_DISABLE_TWILIO");
  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
  );
  const twilioSafeMode = shouldUseSafeMode("SB_TWILIO_SAFE_MODE");

  if (twilioDisabled) {
    results.push({
      check: "twilio",
      status: "WARN",
      detail: "Twilio explicitly disabled."
    });
  } else if (!twilioConfigured) {
    results.push({
      check: "twilio",
      status: "FAIL",
      detail: "Twilio missing credentials.",
      remediation: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER or SB_DISABLE_TWILIO=true."
    });
  } else {
    try {
      const to = String(process.env.TWILIO_TEST_TO || "+15005550006");
      const sms = await sendTwilioMessage({
        to,
        body: "Service Butler integration validation message",
        safeMode: twilioSafeMode
      });

      await insertOutreachEvent({
        supabase,
        tenantId,
        leadId,
        assignmentId,
        channel: "sms",
        outcome: sms.skipped
          ? String(sms.reason || "twilio_skipped")
          : sms.mode === "safe"
            ? "sent_via_twilio_safe_mode"
            : "sent_via_twilio",
        providerMessageId: sms.providerId,
        metadata: {
          safe_mode: twilioSafeMode,
          provider_mode: sms.mode || "unknown"
        }
      });

      results.push({
        check: "twilio",
        status: sms.skipped ? "WARN" : "PASS",
        detail: sms.skipped
          ? `Twilio skipped: ${String(sms.reason || "unknown")}`
          : twilioSafeMode
            ? "Twilio safe mode path validated; outreach event logged."
            : "Twilio send path validated; outreach event logged."
      });
    } catch (error) {
      await insertOutreachEvent({
        supabase,
        tenantId,
        leadId,
        assignmentId,
        channel: "sms",
        outcome: "twilio_validation_failed",
        providerMessageId: null,
        metadata: {
          error: error instanceof Error ? error.message : "unknown error",
          safe_mode: twilioSafeMode
        }
      });

      results.push({
        check: "twilio",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "Twilio validation failed",
        remediation: "Confirm credentials, sender setup, and (if live mode) test destination number."
      });
    }
  }

  const hubspotDisabled = envTrue("SB_DISABLE_HUBSPOT");
  const hubspotConfigured = Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
  const hubspotSafeMode = shouldUseSafeMode("SB_HUBSPOT_SAFE_MODE");

  if (hubspotDisabled) {
    results.push({
      check: "hubspot",
      status: "WARN",
      detail: "HubSpot explicitly disabled."
    });
  } else if (!hubspotConfigured) {
    results.push({
      check: "hubspot",
      status: "FAIL",
      detail: "HubSpot access token missing.",
      remediation: "Set HUBSPOT_ACCESS_TOKEN or SB_DISABLE_HUBSPOT=true."
    });
  } else {
    const accessCheck = await validateHubSpotAccess();
    if (!accessCheck.ok) {
      results.push({
        check: "hubspot_access",
        status: "FAIL",
        detail: accessCheck.reason || "HubSpot access validation failed",
        remediation: "Confirm token scope and portal access."
      });
    } else {
      results.push({
        check: "hubspot_access",
        status: "PASS",
        detail: `HubSpot token validated${accessCheck.portalId ? ` (portal ${accessCheck.portalId})` : ""}.`
      });
    }

    try {
      const task = await createHubSpotTask({
        title: "Service Butler integration validation",
        body: `Validation run for opportunity ${opportunityId}`,
        dueAtIso: new Date(Date.now() + 30 * 60_000).toISOString(),
        safeMode: hubspotSafeMode
      });

      await insertOutreachEvent({
        supabase,
        tenantId,
        leadId,
        assignmentId,
        channel: "crm_task",
        outcome: task.skipped
          ? String(task.reason || "hubspot_skipped")
          : task.mode === "safe"
            ? "hubspot_task_safe_mode"
            : "hubspot_task_created",
        providerMessageId: task.providerId,
        metadata: {
          safe_mode: hubspotSafeMode,
          provider_mode: task.mode || "unknown"
        }
      });

      if (!task.skipped) {
        await supabase
          .from("v2_leads")
          .update({ crm_sync_status: task.mode === "live" ? "synced" : "not_synced" })
          .eq("tenant_id", tenantId)
          .eq("id", leadId);
      }

      results.push({
        check: "hubspot_task",
        status: task.skipped ? "WARN" : "PASS",
        detail: task.skipped
          ? `HubSpot task skipped: ${String(task.reason || "unknown")}`
          : hubspotSafeMode
            ? "HubSpot safe mode task path validated; outreach event logged."
            : "HubSpot task path validated; outreach event logged."
      });
    } catch (error) {
      await insertOutreachEvent({
        supabase,
        tenantId,
        leadId,
        assignmentId,
        channel: "crm_task",
        outcome: "hubspot_validation_failed",
        providerMessageId: null,
        metadata: {
          error: error instanceof Error ? error.message : "unknown error",
          safe_mode: hubspotSafeMode
        }
      });

      results.push({
        check: "hubspot_task",
        status: "FAIL",
        detail: error instanceof Error ? error.message : "HubSpot task validation failed",
        remediation: "Confirm HubSpot API token scope and task object permissions."
      });
    }
  }

  const { data: leadSyncRow } = await supabase
    .from("v2_leads")
    .select("id,opportunity_id,crm_sync_status")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();

  if (leadSyncRow?.opportunity_id) {
    results.push({
      check: "lead_opportunity_link",
      status: "PASS",
      detail: `Lead is linked to opportunity. crm_sync_status=${leadSyncRow.crm_sync_status || "unknown"}`
    });
  } else {
    results.push({
      check: "lead_opportunity_link",
      status: "FAIL",
      detail: "Lead/opportunity linkage not found after validation flow.",
      remediation: "Check v2_leads.opportunity_id writes in pilot flow."
    });
  }

  printResults(results);

  const failCount = results.filter((r) => r.status === "FAIL").length;
  if (failCount > 0) process.exit(1);
}

function printResults(results: ValidationRow[]) {
  console.log("\nIntegration Validation Report\n");
  for (const row of results) {
    const prefix = row.status === "PASS" ? "[PASS]" : row.status === "WARN" ? "[WARN]" : "[FAIL]";
    console.log(`${prefix} ${row.check}: ${row.detail}`);
    if (row.remediation) {
      console.log(`       remediation: ${row.remediation}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
