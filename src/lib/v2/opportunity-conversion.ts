import { getOpportunityQualificationSnapshot, qualificationAllowsDispatch } from "@/lib/v2/opportunity-qualification";
import { findLeadMatch, mergeContactChannels } from "@/lib/v2/lead-matching";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toSlaSchedule(slaMinutes: unknown) {
  const minutes = Number(slaMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(Date.now() + Math.round(minutes) * 60_000).toISOString();
}

type SupabaseSingleResult = Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>;

type SupabaseChain = {
  select: (fields: string) => SupabaseChain;
  eq: (field: string, value: unknown) => SupabaseChain;
  in: (field: string, values: unknown[]) => SupabaseChain;
  order: (field: string, options?: { ascending?: boolean }) => SupabaseChain;
  limit: (count: number) => SupabaseChain;
  maybeSingle: () => SupabaseSingleResult;
  single: () => SupabaseSingleResult;
  insert: (payload: Record<string, unknown>) => SupabaseChain;
  update: (payload: Record<string, unknown>) => SupabaseChain;
};

type MinimalSupabase = { from: (table: string) => SupabaseChain };

export type ConvertOpportunityToJobInput = {
  supabase: MinimalSupabase;
  tenantId: string;
  opportunityId: string;
  actorUserId: string;
};

export type ConvertOpportunityToJobResult = {
  created: boolean;
  opportunityId: string;
  leadId: string;
  jobId: string;
  assignmentUpdated: boolean;
  warnings: string[];
};

export async function convertOpportunityToJobV2(input: ConvertOpportunityToJobInput): Promise<ConvertOpportunityToJobResult> {
  const { supabase, tenantId, opportunityId, actorUserId } = input;
  const warnings: string[] = [];
  const nowIso = new Date().toISOString();

  const { data: opportunity, error: opportunityError } = await (supabase
    .from("v2_opportunities")
    .select("id,title,service_line,location_text,postal_code,lifecycle_status,contact_status,routing_status,explainability_json")
    .eq("tenant_id", tenantId)
    .eq("id", opportunityId)
    .maybeSingle() as SupabaseSingleResult);

  if (opportunityError || !opportunity?.id) {
    throw new Error(opportunityError?.message || "Opportunity not found");
  }

  const explainability = asRecord(opportunity.explainability_json);
  const qualification = getOpportunityQualificationSnapshot({
    explainability,
    lifecycleStatus: opportunity.lifecycle_status,
    contactStatus: opportunity.contact_status
  });

  if (Boolean(explainability.review_required) || !qualificationAllowsDispatch(qualification)) {
    throw new Error("Opportunity requires review/verified contact before conversion");
  }

  const incomingChannels = {
    phone: qualification.phone || null,
    email: qualification.email || null,
    verification_status: qualification.verificationStatus || "verified",
    contact_provenance: qualification.qualificationSource || "operator_queue_conversion",
    verification_reasons: asArray(explainability.sdr_verification_reasons),
    contact_evidence: ["conversion", qualification.phone ? "phone" : "", qualification.email ? "email" : ""].filter(Boolean)
  };

  const existingLeadsResponse = (await (supabase
    .from("v2_leads")
    .select("id,opportunity_id,contact_channels_json,property_address,city,state,postal_code,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200))) as unknown as { data?: Array<Record<string, unknown>> | null; error?: { message?: string } | null };

  if (existingLeadsResponse.error) throw new Error(existingLeadsResponse.error.message || "Failed loading existing leads");

  const matchedLead = findLeadMatch({
    existing: ((existingLeadsResponse.data || []) as Array<Record<string, unknown>>).map((row) => {
      const channels = asRecord(row.contact_channels_json);
      return {
        id: asText(row.id),
        opportunityId: asText(row.opportunity_id) || null,
        phone: asText(channels.phone),
        email: asText(channels.email),
        address: asText(row.property_address) || null,
        city: asText(row.city) || null,
        state: asText(row.state) || null,
        postalCode: asText(row.postal_code) || null,
        serviceType: asText(opportunity.service_line) || null,
        createdAt: asText(row.created_at) || null
      };
    }),
    incoming: {
      opportunityId,
      phone: qualification.phone || null,
      email: qualification.email || null,
      address: asText(explainability.address) || asText(opportunity.location_text) || null,
      city: asText(explainability.city) || null,
      state: asText(explainability.state) || null,
      postalCode: asText(opportunity.postal_code) || null,
      serviceType: asText(opportunity.service_line) || null
    }
  });

  let leadId = matchedLead.matchedLeadId || "";
  let created = false;

  if (leadId && matchedLead.shouldUpdate) {
    const existingRow = ((existingLeadsResponse.data || []) as Array<Record<string, unknown>>).find((row) => asText(row.id) === leadId) || null;
    if (existingRow) {
      const mergedChannels = mergeContactChannels(asRecord(existingRow.contact_channels_json), {
        ...incomingChannels,
        dedupe_reasons: [matchedLead.reason]
      });
      await (supabase
        .from("v2_leads")
        .update({
          opportunity_id: asText(existingRow.opportunity_id) || opportunityId,
          contact_name: qualification.contactName || asText(explainability.contact_name) || asText(opportunity.title) || "Incident contact",
          contact_channels_json: mergedChannels,
          property_address: asText(existingRow.property_address) || asText(explainability.address) || asText(opportunity.location_text) || null,
          city: asText(existingRow.city) || asText(explainability.city) || null,
          state: asText(existingRow.state) || asText(explainability.state) || null,
          postal_code: asText(existingRow.postal_code) || asText(opportunity.postal_code) || null,
          updated_at: nowIso
        })
        .eq("id", leadId)) as unknown as { error?: { message?: string } | null };
    }
  } else if (!leadId) {
    const { data: insertedLead, error: leadError } = await (supabase
      .from("v2_leads")
      .insert({
        tenant_id: tenantId,
        opportunity_id: opportunityId,
        contact_name: qualification.contactName || asText(explainability.contact_name) || asText(opportunity.title) || "Incident contact",
        contact_channels_json: incomingChannels,
        property_address: asText(explainability.address) || asText(opportunity.location_text) || null,
        city: asText(explainability.city) || null,
        state: asText(explainability.state) || null,
        postal_code: asText(opportunity.postal_code) || null,
        lead_status: "new",
        owner_user_id: actorUserId,
        crm_sync_status: "not_synced",
        do_not_contact: false
      })
      .select("id")
      .single() as SupabaseSingleResult);

    if (leadError || !insertedLead?.id) throw new Error(leadError?.message || "Failed creating v2 lead");
    leadId = asText(insertedLead.id);
    created = true;
  }

  const { data: existingJob } = await (supabase
    .from("v2_jobs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("lead_id", leadId)
    .maybeSingle() as SupabaseSingleResult);

  let jobId = existingJob?.id ? asText(existingJob.id) : "";

  if (!jobId) {
    const scheduledAt = toSlaSchedule(explainability.recommended_action_sla_minutes);
    const { data: insertedJob, error: jobError } = await (supabase
      .from("v2_jobs")
      .insert({
        tenant_id: tenantId,
        lead_id: leadId,
        job_type: asText(opportunity.service_line) || "restoration",
        booked_at: nowIso,
        scheduled_at: scheduledAt,
        revenue_amount: 0,
        status: "booked"
      })
      .select("id")
      .single() as SupabaseSingleResult);

    if (jobError || !insertedJob?.id) throw new Error(jobError?.message || "Failed creating v2 job");
    jobId = asText(insertedJob.id);
    created = true;
  }

  await (supabase
    .from("v2_opportunities")
    .update({
      lifecycle_status: "booked_job",
      routing_status: "complete",
      contact_status: "identified",
      updated_at: nowIso
    })
    .eq("tenant_id", tenantId)
    .eq("id", opportunityId));

  const { data: assignment } = await (supabase
    .from("v2_assignments")
    .select("id,status,lead_id")
    .eq("tenant_id", tenantId)
    .eq("opportunity_id", opportunityId)
    .in("status", ["pending_acceptance", "accepted", "escalated"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as SupabaseSingleResult);

  let assignmentUpdated = false;
  if (assignment?.id) {
    const assignmentUpdate = (await (supabase
      .from("v2_assignments")
      .update({
        status: "complete",
        completed_at: nowIso,
        lead_id: assignment.lead_id || leadId
      })
      .eq("id", asText(assignment.id)))) as unknown as { error?: { message?: string } | null };
    const updateAssignmentError = assignmentUpdate.error || null;

    if (!updateAssignmentError) {
      assignmentUpdated = true;
    } else {
      warnings.push(`assignment_update_failed:${updateAssignmentError.message || "unknown"}`);
    }
  }

  return {
    created,
    opportunityId,
    leadId,
    jobId,
    assignmentUpdated,
    warnings
  };
}
