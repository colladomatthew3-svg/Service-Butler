import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { extractVerifiedOwnerContactFromEnrichment } from "@/lib/services/contact-proof";
import { generateSignals } from "@/lib/services/intent-engine";
import type { LeadInput } from "@/lib/services/intent-engine";
import { resolveOpportunityAddress } from "@/lib/services/scanner";
import { isDemoMode } from "@/lib/services/review-mode";
import { isSyntheticScannerRecord } from "@/lib/services/scanner-truth";
import { getForecastByLatLng } from "@/lib/services/weather";
import { findLeadMatch, mergeContactChannels } from "@/lib/v2/lead-matching";
import { getOpportunityQualificationSnapshot, qualificationAllowsDispatch } from "@/lib/v2/opportunity-qualification";
import { classifyProofAuthenticity } from "@/lib/v2/proof-authenticity";
import { qualifiesAsRealSourceCapture } from "@/lib/v2/source-truth";

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

function uniqueNotes(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function toLeadShape(value: Record<string, unknown>): LeadInput & { converted_job_id?: string | null; scheduled_for?: string | null } {
  return {
    id: String(value.id || ""),
    service_type: String(value.service_type || "") || null,
    requested_timeframe: String(value.requested_timeframe || "") || null,
    city: String(value.city || "") || null,
    state: String(value.state || "") || null,
    converted_job_id: String(value.converted_job_id || "") || null,
    scheduled_for: String(value.scheduled_for || "") || null
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoMode()) {
    return NextResponse.json({
      error: "Scanner demo dispatch is disabled. Only real verified public signals can be dispatched."
    }, { status: 409 });
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

  if (isSyntheticScannerRecord({ source: event.source, raw: event.raw })) {
    return NextResponse.json(
      {
        error: "Synthetic scanner records cannot be dispatched. Only real public signals are eligible.",
        status: "research_only",
        reason_code: "synthetic_signal_blocked",
        next_step: "run_live_scan",
        proof_authenticity: String(event.raw?.proof_authenticity || "synthetic"),
        source_type: String(event.raw?.source_type || event.source || "scanner_signal"),
        scanner_event_id: event.id
      },
      { status: 409 }
    );
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

  const qualification = v2Opportunity
    ? getOpportunityQualificationSnapshot({
        explainability: v2Opportunity.explainability,
        lifecycleStatus: v2Opportunity.lifecycleStatus,
        contactStatus: v2Opportunity.contactStatus
      })
    : null;

  if (v2Opportunity) {
    let sourceEvent: Record<string, unknown> | null = null;
    let source: Record<string, unknown> | null = null;
    let connectorRun: Record<string, unknown> | null = null;

    const sourceEventId = String(v2Opportunity.explainability.source_event_id || "").trim();
    if (sourceEventId) {
      const { data: sourceEventRow } = await supabase
        .from("v2_source_events")
        .select("id,source_id,connector_run_id,compliance_status,normalized_payload")
        .eq("tenant_id", v2Opportunity.tenantId)
        .eq("id", sourceEventId)
        .maybeSingle();

      if (sourceEventRow) {
        sourceEvent = sourceEventRow as Record<string, unknown>;

        const sourceId = String(sourceEventRow.source_id || "").trim();
        if (sourceId) {
          const { data: sourceRow } = await supabase
            .from("v2_data_sources")
            .select("id,status,terms_status,compliance_status,rollout_state,readiness_status,health_status,freshness_timestamp,freshness_sla_minutes")
            .eq("tenant_id", v2Opportunity.tenantId)
            .eq("id", sourceId)
            .maybeSingle();
          if (sourceRow) source = sourceRow as Record<string, unknown>;
        }

        const connectorRunId = String(sourceEventRow.connector_run_id || "").trim();
        if (connectorRunId) {
          const { data: connectorRunRow } = await supabase
            .from("v2_connector_runs")
            .select("id,status,metadata")
            .eq("tenant_id", v2Opportunity.tenantId)
            .eq("id", connectorRunId)
            .maybeSingle();
          if (connectorRunRow) connectorRun = connectorRunRow as Record<string, unknown>;
        }
      }
    }

    const proofAuthenticity = classifyProofAuthenticity({
      sourceType:
        Array.isArray(v2Opportunity.explainability.source_types) && v2Opportunity.explainability.source_types.length > 0
          ? v2Opportunity.explainability.source_types[0]
          : v2Opportunity.explainability.source_type || event.source || event.category,
      sourceName: v2Opportunity.explainability.source_name,
      sourceProvenance: v2Opportunity.explainability.source_provenance,
      normalizedPayload: sourceEvent ? asRecord(sourceEvent.normalized_payload) : v2Opportunity.explainability,
      connectorRunMetadata: connectorRun ? asRecord(connectorRun.metadata) : {}
    });

    const sourceTruthEligible = qualifiesAsRealSourceCapture({
      authenticity: proofAuthenticity,
      explainability: v2Opportunity.explainability,
      source,
      sourceEvent,
      connectorRun
    });

    if (!sourceTruthEligible) {
      return NextResponse.json(
        {
          error: "This scanner signal is not backed by a live-safe approved source chain yet. Keep it in research mode until source truth is validated.",
          status: "research_only",
          reason_code: "source_truth_blocked",
          next_step: qualification?.nextRecommendedAction || "route_to_sdr",
          proof_authenticity: proofAuthenticity,
          source_type:
            qualification?.sourceType ||
            String(v2Opportunity.explainability.source_type || event.raw?.source_type || event.source || "scanner_signal"),
          scanner_event_id: event.id,
          opportunity_id: v2Opportunity.id
        },
        { status: 409 }
      );
    }
  }

  const verifiedOwnerContact = extractVerifiedOwnerContactFromEnrichment(event.raw?.enrichment);
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

  const { data: existingLegacyLeads, error: existingLegacyLeadsError } = await supabase
    .from("leads")
    .select("id,status,stage,name,phone,service_type,address,city,state,postal_code,requested_timeframe,notes,converted_job_id,scheduled_for,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (existingLegacyLeadsError) {
    return NextResponse.json({ error: existingLegacyLeadsError.message || "Failed loading existing leads" }, { status: 400 });
  }

  const legacyLeadMatch = findLeadMatch({
    existing: ((existingLegacyLeads || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id || ""),
      phone: String(row.phone || ""),
      address: String(row.address || ""),
      city: String(row.city || ""),
      state: String(row.state || ""),
      postalCode: String(row.postal_code || ""),
      serviceType: String(row.service_type || ""),
      createdAt: String(row.created_at || "")
    })),
    incoming: {
      phone: dispatchContact.phone || null,
      email: dispatchContact.email || null,
      address: addressInfo.address,
      city: addressInfo.city,
      state: addressInfo.state,
      postalCode: addressInfo.postalCode,
      serviceType: leadPayload.service_type
    }
  });

  let lead: (LeadInput & { converted_job_id?: string | null; scheduled_for?: string | null }) | null = null;
  if (legacyLeadMatch.matchedLeadId) {
    const existingLeadRow = ((existingLegacyLeads || []) as Array<Record<string, unknown>>).find((row) => String(row.id || "") === legacyLeadMatch.matchedLeadId) || null;
    if (existingLeadRow) {
      if (legacyLeadMatch.shouldUpdate) {
        const mergedNotes = uniqueNotes([
          String(existingLeadRow.notes || ""),
          leadPayload.notes,
          `dedupe=${legacyLeadMatch.reason}`,
          `scanner_event_id=${event.id}`
        ]).join(" | ");

        const { data: updatedLead, error: updatedLeadError } = await supabase
          .from("leads")
          .update({
            name: String(existingLeadRow.name || "").trim() || leadPayload.name,
            phone: String(existingLeadRow.phone || "").trim() || leadPayload.phone,
            service_type: String(existingLeadRow.service_type || "").trim() || leadPayload.service_type,
            address: String(existingLeadRow.address || "").trim() || leadPayload.address,
            city: String(existingLeadRow.city || "").trim() || leadPayload.city,
            state: String(existingLeadRow.state || "").trim() || leadPayload.state,
            postal_code: String(existingLeadRow.postal_code || "").trim() || leadPayload.postal_code,
            requested_timeframe: String(existingLeadRow.requested_timeframe || "").trim() || leadPayload.requested_timeframe,
            notes: mergedNotes
          })
          .eq("account_id", accountId)
          .eq("id", legacyLeadMatch.matchedLeadId)
          .select("id,service_type,requested_timeframe,address,city,state,postal_code,converted_job_id,scheduled_for")
          .single();

        if (updatedLeadError || !updatedLead) {
          return NextResponse.json({ error: updatedLeadError?.message || "Failed updating existing lead" }, { status: 400 });
        }
        lead = toLeadShape(updatedLead as Record<string, unknown>);
      } else {
        lead = toLeadShape(existingLeadRow);
      }
    }
  }

  if (!lead) {
    const { data: insertedLead, error: leadError } = await supabase
      .from("leads")
      .insert(leadPayload)
      .select("id,service_type,requested_timeframe,address,city,state,postal_code,converted_job_id,scheduled_for")
      .single();

    if (leadError || !insertedLead) {
      return NextResponse.json({ error: leadError?.message || "Failed to create lead" }, { status: 400 });
    }
    lead = toLeadShape(insertedLead as Record<string, unknown>);
  }

  const legacyLeadReused = legacyLeadMatch.outcome !== "create_new";
  if (!lead) {
    return NextResponse.json({ error: "Failed to resolve lead" }, { status: 400 });
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
    const incomingV2Channels = {
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
    };

    const { data: existingV2Leads, error: existingV2LeadsError } = await supabase
      .from("v2_leads")
      .select("id,opportunity_id,contact_channels_json,property_address,city,state,postal_code,created_at")
      .eq("tenant_id", v2Opportunity.tenantId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (existingV2LeadsError) {
      return NextResponse.json({ error: existingV2LeadsError.message || "Failed loading existing v2 leads" }, { status: 400 });
    }

    const v2LeadMatch = findLeadMatch({
      existing: ((existingV2Leads || []) as Array<Record<string, unknown>>).map((row) => {
        const channels = asRecord(row.contact_channels_json);
        return {
          id: String(row.id || ""),
          opportunityId: String(row.opportunity_id || ""),
          phone: String(channels.phone || ""),
          email: String(channels.email || ""),
          address: String(row.property_address || ""),
          city: String(row.city || ""),
          state: String(row.state || ""),
          postalCode: String(row.postal_code || ""),
          serviceType: leadPayload.service_type,
          createdAt: String(row.created_at || "")
        };
      }),
      incoming: {
        opportunityId: v2Opportunity.id,
        phone: dispatchContact.phone || null,
        email: dispatchContact.email || null,
        address: addressInfo.address,
        city: addressInfo.city,
        state: addressInfo.state,
        postalCode: addressInfo.postalCode,
        serviceType: leadPayload.service_type
      }
    });

    if (v2LeadMatch.matchedLeadId) {
      v2LeadId = String(v2LeadMatch.matchedLeadId);
      if (v2LeadMatch.shouldUpdate) {
        const existingV2Lead = ((existingV2Leads || []) as Array<Record<string, unknown>>).find((row) => String(row.id || "") === v2LeadId) || null;
        if (existingV2Lead) {
          await supabase
            .from("v2_leads")
            .update({
              opportunity_id: String(existingV2Lead.opportunity_id || "").trim() || v2Opportunity.id,
              contact_name: String(existingV2Lead.contact_name || "").trim() || dispatchContact.name || event.title,
              contact_channels_json: mergeContactChannels(asRecord(existingV2Lead.contact_channels_json), {
                ...incomingV2Channels,
                dedupe_reasons: [v2LeadMatch.reason, `scanner_event_id=${event.id}`]
              }),
              property_address: String(existingV2Lead.property_address || "").trim() || addressInfo.address || null,
              city: String(existingV2Lead.city || "").trim() || addressInfo.city || null,
              state: String(existingV2Lead.state || "").trim() || addressInfo.state || null,
              postal_code: String(existingV2Lead.postal_code || "").trim() || addressInfo.postalCode || null,
              updated_at: new Date().toISOString()
            })
            .eq("id", v2LeadId);
        }
      }
    } else {
      const { data: v2Lead } = await supabase
        .from("v2_leads")
        .insert({
          tenant_id: v2Opportunity.tenantId,
          opportunity_id: v2Opportunity.id,
          contact_name: dispatchContact.name || event.title,
          contact_channels_json: incomingV2Channels,
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
      v2LeadId,
      leadReused: legacyLeadReused,
      leadMatchReason: legacyLeadReused ? legacyLeadMatch.reason : null
    });
  }

  const scheduleIso = body.scheduleIso || recommendedSchedule(Number(event.intent_score) || 60, Number(rule?.default_sla_minutes) || 60);
  const estimatedValue = Math.max(0, Math.round((Number(rule?.default_job_value_cents) || 60000) / 100));

  let existingJobId = String(lead.converted_job_id || "").trim();
  if (!existingJobId) {
    const { data: existingLeadJob } = await supabase
      .from("lead_jobs")
      .select("job_id")
      .eq("account_id", accountId)
      .eq("lead_id", lead.id)
      .maybeSingle();
    existingJobId = String(existingLeadJob?.job_id || "").trim();
  }

  let job: Record<string, unknown> | null = existingJobId ? { id: existingJobId } : null;
  let jobError: { message?: string } | null = null;
  if (!job) {
    const jobInsertResult = await supabase
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
    job = jobInsertResult.data as Record<string, unknown> | null;
    jobError = jobInsertResult.error;
  }

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
    const { data: existingV2Job } = await supabase
      .from("v2_jobs")
      .select("id")
      .eq("tenant_id", v2Opportunity.tenantId)
      .eq("lead_id", v2LeadId)
      .maybeSingle();

    if (existingV2Job?.id) {
      v2JobId = String(existingV2Job.id);
    } else {
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
    }

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
    v2JobId,
    leadReused: legacyLeadReused,
    leadMatchReason: legacyLeadReused ? legacyLeadMatch.reason : null
  });
}
