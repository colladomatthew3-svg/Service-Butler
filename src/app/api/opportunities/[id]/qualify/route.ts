import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import {
  buildQualificationUpdate,
  getOpportunityQualificationSnapshot,
  type OpportunityQualificationMutation,
  validateQualificationMutation
} from "@/lib/v2/opportunity-qualification";
import { getV2TenantContext } from "@/lib/v2/context";
import { maybeQueueQualificationOutreach } from "@/lib/v2/qualification-outreach-bridge";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountRole } from "@/types/domain";

type Params = {
  params: Promise<{ id: string }>;
};

async function resolveOpportunityId({
  tenantId,
  sourceId,
  scannerOpportunityId,
  supabase
}: {
  tenantId: string;
  sourceId: string;
  scannerOpportunityId?: string | null;
  supabase: SupabaseClient;
}) {
  const direct = await supabase
    .from("v2_opportunities")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", sourceId)
    .maybeSingle();

  if (direct.data?.id) return String(direct.data.id);

  if (!scannerOpportunityId) return null;

  const linked = await supabase
    .from("v2_opportunities")
    .select("id")
    .eq("tenant_id", tenantId)
    .contains("explainability_json", { scanner_event_id: scannerOpportunityId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linked.data?.id) return String(linked.data.id);

  const legacyLinked = await supabase
    .from("v2_opportunities")
    .select("id")
    .eq("tenant_id", tenantId)
    .contains("explainability_json", { scanner_opportunity_id: scannerOpportunityId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return legacyLinked.data?.id ? String(legacyLinked.data.id) : null;
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!featureFlags.useV2Writes) {
    return NextResponse.json({ error: "Enable SB_USE_V2_WRITES to qualify opportunities" }, { status: 409 });
  }

  const context = await getV2TenantContext().catch(() => null);
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as OpportunityQualificationMutation & {
    scannerOpportunityId?: string | null;
  };

  const validationError = validateQualificationMutation(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const opportunityId = await resolveOpportunityId({
    tenantId: context.franchiseTenantId,
    sourceId: String(id || "").trim(),
    scannerOpportunityId: body.scannerOpportunityId ? String(body.scannerOpportunityId) : String(id || "").trim(),
    supabase: context.supabase
  });

  if (!opportunityId) {
    return NextResponse.json({ error: "Opportunity not found for qualification" }, { status: 404 });
  }

  const { data: opportunity, error: loadError } = await context.supabase
    .from("v2_opportunities")
    .select("id,urgency_score,location_text,explainability_json")
    .eq("tenant_id", context.franchiseTenantId)
    .eq("id", opportunityId)
    .maybeSingle();

  if (loadError || !opportunity?.id) {
    return NextResponse.json({ error: loadError?.message || "Opportunity not found" }, { status: 404 });
  }

  const update = buildQualificationUpdate({
    explainability: opportunity.explainability_json,
    mutation: body,
    actorUserId: context.userId
  });

  const { data: updated, error: updateError } = await context.supabase
    .from("v2_opportunities")
    .update({
      lifecycle_status: update.lifecycleStatus,
      contact_status: update.contactStatus,
      explainability_json: update.explainability
    })
    .eq("tenant_id", context.franchiseTenantId)
    .eq("id", opportunityId)
    .select("id,urgency_score,location_text,lifecycle_status,contact_status,explainability_json")
    .single();

  if (updateError || !updated?.id) {
    return NextResponse.json({ error: updateError?.message || "Opportunity qualification failed" }, { status: 400 });
  }

  const qualification = getOpportunityQualificationSnapshot({
    explainability: updated.explainability_json,
    lifecycleStatus: updated.lifecycle_status,
    contactStatus: updated.contact_status
  });

  // When an opportunity becomes contactable, queue a first-touch outreach
  let outreachResult: { triggered: boolean; channel?: string | null } = { triggered: false };
  if (qualification.qualificationStatus === "qualified_contactable") {
    const explainJson = (updated.explainability_json as Record<string, unknown> | null) ?? {};
    const bridge = await maybeQueueQualificationOutreach(context.supabase, {
      opportunityId: opportunityId,
      tenantId: context.franchiseTenantId,
      actorUserId: context.userId,
      franchiseVerticalKey: context.franchiseVertical ?? null,
      urgencyScore: typeof updated.urgency_score === "number" ? updated.urgency_score : typeof explainJson.urgency_score === "number" ? explainJson.urgency_score : null,
      contactName: qualification.contactName,
      phone: qualification.phone,
      email: qualification.email,
      address:
        typeof explainJson.address === "string"
          ? explainJson.address
          : typeof updated.location_text === "string"
            ? updated.location_text
            : null,
      serviceType: qualification.sourceType,
    }).catch(() => ({ triggered: false }));
    outreachResult = bridge;
  }

  return NextResponse.json({
    opportunity: {
      id: updated.id,
      lifecycle_status: updated.lifecycle_status,
      contact_status: updated.contact_status,
      explainability: updated.explainability_json
    },
    qualification_status: qualification.qualificationStatus,
    qualification_reason_code: qualification.qualificationReasonCode,
    next_recommended_action: qualification.nextRecommendedAction,
    proof_authenticity: qualification.proofAuthenticity,
    source_type: qualification.sourceType,
    contact_name: qualification.contactName,
    phone: qualification.phone,
    email: qualification.email,
    verification_status: qualification.verificationStatus,
    qualification_source: qualification.qualificationSource,
    qualification_notes: qualification.qualificationNotes,
    qualified_at: qualification.qualifiedAt,
    qualified_by: qualification.qualifiedBy,
    research_only: qualification.researchOnly,
    requires_sdr_qualification: qualification.requiresSdrQualification,
    outreach_queued: outreachResult.triggered,
    outreach_channel: outreachResult.triggered ? (outreachResult as { channel?: string | null }).channel ?? null : null,
  });
}
