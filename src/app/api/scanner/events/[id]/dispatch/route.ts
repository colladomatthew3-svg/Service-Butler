import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { dispatchDemoScannerEvent } from "@/lib/demo/store";
import { extractVerifiedOwnerContactFromEnrichment } from "@/lib/services/contact-proof";
import { generateSignals } from "@/lib/services/intent-engine";
import { resolveOpportunityAddress } from "@/lib/services/scanner";
import { isDemoMode } from "@/lib/services/review-mode";
import { getForecastByLatLng } from "@/lib/services/weather";
import { getOpportunityQualificationSnapshot, qualificationAllowsDispatch } from "@/lib/v2/opportunity-qualification";

type CreateMode = "lead" | "job";

function normalizeMode(input: unknown): CreateMode | null {
  if (input == null) return null;
  return String(input).toLowerCase() === "job" ? "job" : "lead";
}

function statusFromMode(mode: CreateMode) {
  return mode === "job" ? "scheduled" : "new";
}

function stageFromStatus(status: string) {
  if (status === "scheduled") return "BOOKED";
  if (status === "contacted") return "CONTACTED";
  if (status === "won") return "COMPLETED";
  if (status === "lost") return "LOST";
  return "NEW";
}

function recommendedSchedule(intent: number, slaMinutes: number) {
  const d = new Date(Date.now() + Math.max(15, slaMinutes) * 60_000);
  if (intent >= 78) {
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
  }
  return d.toISOString();
}

function categoryService(category: string) {
  const c = String(category || "general").toLowerCase();
  if (c === "restoration") return "Restoration";
  if (c === "plumbing") return "Plumbing";
  if (c === "demolition") return "Demolition";
  if (c === "asbestos") return "Asbestos";
  return "General";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoMode()) {
    const body = (await req.json().catch(() => ({}))) as {
      createMode?: CreateMode;
    };
    const result = dispatchDemoScannerEvent(id, normalizeMode(body.createMode) || undefined);
    if (!result) {
      return NextResponse.json({ error: "Scanner event not found" }, { status: 404 });
    }

    return NextResponse.json({
      dispatched: true,
      mode: result.mode,
      leadId: result.leadId,
      jobId: result.jobId,
      message: result.message,
      redirectPath: "/dashboard/scanner?demoAction=1"
    });
  }

  const { accountId, role, supabase, userId } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = (await req.json().catch(() => ({}))) as {
    createMode?: CreateMode;
    assignee?: string;
    scheduleIso?: string;
  };

  const { data: event, error: eventError } = await supabase
    .from("scanner_events")
    .select("id,source,category,title,description,location_text,intent_score,confidence,tags,raw,lat,lon")
    .eq("account_id", accountId)
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Scanner event not found" }, { status: 404 });
  }

  const { data: rule } = await supabase
    .from("routing_rules")
    .select("id,default_assignee,default_create_mode,default_job_value_cents,default_sla_minutes,enabled")
    .eq("account_id", accountId)
    .eq("category", String(event.category || "general").toLowerCase())
    .eq("enabled", true)
    .maybeSingle();

  const mode = normalizeMode(body.createMode) || (rule?.default_create_mode as CreateMode | null) || (Number(event.intent_score) >= 75 ? "job" : "lead");
  const assignee = (body.assignee || rule?.default_assignee || "Dispatch Queue").trim();
  const { data: contractor } = await supabase
    .from("contractors")
    .select("id")
    .eq("account_id", accountId)
    .eq("name", assignee)
    .maybeSingle();

  const addressInfo = resolveOpportunityAddress({
    locationText: String(event.raw?.property_address || event.location_text || ""),
    lat: event.lat,
    lon: event.lon,
    serviceAreaLabel: String(event.raw?.service_area_label || event.location_text || "Service Area"),
    seed: event.id
  });

  let v2Opportunity:
    | {
        id: string;
        tenantId: string;
        lifecycleStatus: string;
        contactStatus: string;
        explainability: Record<string, unknown>;
      }
    | null = null;

  if (featureFlags.useV2Reads || featureFlags.useV2Writes) {
    const { data: tenantMap } = await supabase
      .from("v2_account_tenant_map")
      .select("franchise_tenant_id")
      .eq("account_id", accountId)
      .maybeSingle();

    const tenantId = String(tenantMap?.franchise_tenant_id || "").trim();
    if (tenantId) {
      const requestedOpportunityId = String(event.raw?.v2_opportunity_id || "").trim();
      const query = requestedOpportunityId
        ? supabase
            .from("v2_opportunities")
            .select("id,lifecycle_status,contact_status,explainability_json")
            .eq("tenant_id", tenantId)
            .eq("id", requestedOpportunityId)
            .maybeSingle()
        : supabase
            .from("v2_opportunities")
            .select("id,lifecycle_status,contact_status,explainability_json,created_at")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false })
            .limit(200);

      const { data } = await query;
      if (Array.isArray(data)) {
        const matched = data.find((row) => {
          const qualification = getOpportunityQualificationSnapshot({
            explainability: row.explainability_json,
            lifecycleStatus: row.lifecycle_status,
            contactStatus: row.contact_status
          });
          return qualification.scannerEventId === event.id;
        });
        if (matched?.id) {
          v2Opportunity = {
            id: String(matched.id),
            tenantId,
            lifecycleStatus: String(matched.lifecycle_status || "new"),
            contactStatus: String(matched.contact_status || "unknown"),
            explainability: asRecord(matched.explainability_json)
          };
        }
      } else if (data?.id) {
        v2Opportunity = {
          id: String(data.id),
          tenantId,
          lifecycleStatus: String(data.lifecycle_status || "new"),
          contactStatus: String(data.contact_status || "unknown"),
          explainability: asRecord(data.explainability_json)
        };
      }
    }
  }

  const verifiedOwnerContact = extractVerifiedOwnerContactFromEnrichment(event.raw?.enrichment);
  const qualification = v2Opportunity
    ? getOpportunityQualificationSnapshot({
        explainability: v2Opportunity.explainability,
        lifecycleStatus: v2Opportunity.lifecycleStatus,
        contactStatus: v2Opportunity.contactStatus
      })
    : null;
  const dispatchContact = verifiedOwnerContact || (qualification && qualificationAllowsDispatch(qualification)
    ? {
        name: qualification.contactName,
        phone: qualification.phone,
        email: qualification.email,
        verification: qualification.verificationStatus || "verified"
      }
    : null);

  if (!dispatchContact?.phone && !dispatchContact?.email) {
    return NextResponse.json(
      {
        error: "This scanner signal does not have a verified phone contact yet. Keep it in research mode or qualify it through SDR before creating a lead.",
        status: "research_only",
        reason_code: qualification?.qualificationReasonCode || "missing_verified_contact",
        next_step: qualification?.nextRecommendedAction || "route_to_sdr",
        proof_authenticity: qualification?.proofAuthenticity || String(event.raw?.proof_authenticity || "unknown"),
        source_type: qualification?.sourceType || String(event.raw?.source_type || event.source || "scanner_signal"),
        scanner_event_id: event.id,
        opportunity_id: v2Opportunity?.id || (typeof event.raw?.v2_opportunity_id === "string" ? event.raw.v2_opportunity_id : null)
      },
      { status: 409 }
    );
  }

  const leadPayload = {
    account_id: accountId,
    source: "scanner_verified_contact",
    stage: stageFromStatus(statusFromMode(mode)),
    status: statusFromMode(mode),
    name: dispatchContact.name || event.title,
    phone: dispatchContact.phone || null,
    service_type: categoryService(event.category),
    address: addressInfo.address,
    city: addressInfo.city,
    state: addressInfo.state,
    postal_code: addressInfo.postalCode,
    requested_timeframe: Number(event.intent_score) >= 78 ? "ASAP" : "Today",
    notes: [
      `Scanner dispatch: ${event.description || "opportunity"}`,
      `contact_verification=${dispatchContact.verification || "verified"}`,
      dispatchContact.email ? `email=${dispatchContact.email}` : ""
    ]
      .filter(Boolean)
      .join(" | ")
  };

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert(leadPayload)
    .select("id,service_type,requested_timeframe,address,city,state,postal_code")
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: leadError?.message || "Failed to create lead" }, { status: 400 });
  }

  let forecast = null;
  if (event.lat != null && event.lon != null) {
    forecast = await getForecastByLatLng(Number(event.lat), Number(event.lon)).catch(() => null);
  }

  const signals = generateSignals({ lead, forecast });
  if (signals.length > 0) {
    await supabase.from("lead_intent_signals").insert(
      signals.map((signal) => ({
        lead_id: lead.id,
        ...signal
      }))
    );
  }

  let v2LeadId: string | null = null;
  if (v2Opportunity && featureFlags.useV2Writes) {
    const { data: existingLead } = await supabase
      .from("v2_leads")
      .select("id")
      .eq("tenant_id", v2Opportunity.tenantId)
      .eq("opportunity_id", v2Opportunity.id)
      .maybeSingle();

    if (existingLead?.id) {
      v2LeadId = String(existingLead.id);
    } else {
      const { data: v2Lead } = await supabase
        .from("v2_leads")
        .insert({
          tenant_id: v2Opportunity.tenantId,
          opportunity_id: v2Opportunity.id,
          contact_name: dispatchContact.name || event.title,
          contact_channels_json: {
            phone: dispatchContact.phone || null,
            email: dispatchContact.email || null,
            verification_status: dispatchContact.verification || "verified",
            verification_score: dispatchContact.verification === "verified" ? 92 : 72,
            verification_reasons: [
              qualification?.qualificationSource ? `qualification_source=${qualification.qualificationSource}` : "",
              qualification?.qualifiedAt ? `qualified_at=${qualification.qualifiedAt}` : "",
              verifiedOwnerContact ? "enrichment_verified_contact" : "sdr_qualified_contact"
            ].filter(Boolean),
            contact_provenance: qualification?.qualificationSource || (verifiedOwnerContact ? "scanner_enrichment" : "scanner_sdr"),
            contact_evidence: [
              dispatchContact.phone ? "phone" : "",
              dispatchContact.email ? "email" : "",
              qualification?.qualificationNotes ? "qualification_notes" : ""
            ].filter(Boolean)
          },
          property_address: addressInfo.address || null,
          city: addressInfo.city || null,
          state: addressInfo.state || null,
          postal_code: addressInfo.postalCode || null,
          lead_status: "new",
          owner_user_id: userId,
          crm_sync_status: "not_synced",
          do_not_contact: false
        })
        .select("id")
        .single();

      v2LeadId = v2Lead?.id ? String(v2Lead.id) : null;
    }
  }

  if (mode === "lead") {
    await supabase
      .from("opportunities")
      .update({ status: "claimed", claimed_by_contractor_id: contractor?.id || null })
      .eq("account_id", accountId)
      .contains("raw", { scanner_opportunity_id: id });

    if (v2Opportunity && featureFlags.useV2Writes) {
      await supabase
        .from("v2_opportunities")
        .update({
          lifecycle_status: "qualified",
          contact_status: "identified"
        })
        .eq("tenant_id", v2Opportunity.tenantId)
        .eq("id", v2Opportunity.id);
    }

    return NextResponse.json({
      dispatched: true,
      mode,
      leadId: lead.id,
      jobId: null,
      opportunityId: v2Opportunity?.id || null,
      v2LeadId
    });
  }

  const scheduleIso = body.scheduleIso || recommendedSchedule(Number(event.intent_score) || 60, Number(rule?.default_sla_minutes) || 60);
  const estimatedValue = Math.max(0, Math.round((Number(rule?.default_job_value_cents) || 60000) / 100));

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      account_id: accountId,
      lead_id: lead.id,
      status: "SCHEDULED",
      pipeline_status: "SCHEDULED",
      scheduled_for: scheduleIso,
      service_type: leadPayload.service_type,
      assigned_tech_name: assignee,
      estimated_value: estimatedValue,
      notes: `Auto-created from scanner event ${event.id}`,
      intent_score: Number(event.intent_score) || 0,
      customer_name: leadPayload.name,
      customer_phone: leadPayload.phone,
      city: leadPayload.city,
      state: leadPayload.state
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message || "Failed to create job" }, { status: 400 });
  }

  await supabase.from("lead_jobs").upsert(
    {
      account_id: accountId,
      lead_id: lead.id,
      job_id: job.id
    },
    { onConflict: "account_id,lead_id" }
  );

  await supabase
    .from("leads")
    .update({ converted_job_id: job.id, stage: "BOOKED", status: "scheduled", scheduled_for: scheduleIso })
    .eq("account_id", accountId)
    .eq("id", lead.id);

  await supabase
    .from("opportunities")
    .update({ status: "claimed", claimed_by_contractor_id: contractor?.id || null })
    .eq("account_id", accountId)
    .contains("raw", { scanner_opportunity_id: id });

  let v2JobId: string | null = null;
  if (v2Opportunity && v2LeadId && featureFlags.useV2Writes) {
    const { data: v2Job } = await supabase
      .from("v2_jobs")
      .insert({
        tenant_id: v2Opportunity.tenantId,
        lead_id: v2LeadId,
        job_type: leadPayload.service_type,
        booked_at: new Date().toISOString(),
        scheduled_at: scheduleIso,
        revenue_amount: estimatedValue,
        status: "booked"
      })
      .select("id")
      .single();

    v2JobId = v2Job?.id ? String(v2Job.id) : null;

    await supabase
      .from("v2_opportunities")
      .update({
        lifecycle_status: "booked_job",
        contact_status: "identified"
      })
      .eq("tenant_id", v2Opportunity.tenantId)
      .eq("id", v2Opportunity.id);
  }

  return NextResponse.json({
    dispatched: true,
    mode,
    leadId: lead.id,
    jobId: job.id,
    scheduleIso,
    opportunityId: v2Opportunity?.id || null,
    v2LeadId,
    v2JobId
  });
}
