import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import {
  buildQualificationUpdate,
  type OpportunityQualificationMutation,
  validateQualificationMutation
} from "@/lib/v2/opportunity-qualification";
import { getV2TenantContext } from "@/lib/v2/context";
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
    .select("id,explainability_json")
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
    .select("id,lifecycle_status,contact_status,explainability_json")
    .single();

  if (updateError || !updated?.id) {
    return NextResponse.json({ error: updateError?.message || "Opportunity qualification failed" }, { status: 400 });
  }

  return NextResponse.json({
    opportunity: {
      id: updated.id,
      lifecycle_status: updated.lifecycle_status,
      contact_status: updated.contact_status,
      explainability: updated.explainability_json
    },
    qualification_status: (updated.explainability_json as Record<string, unknown> | null)?.qualification_status || null,
    qualification_reason_code: (updated.explainability_json as Record<string, unknown> | null)?.qualification_reason_code || null,
    next_recommended_action: (updated.explainability_json as Record<string, unknown> | null)?.next_recommended_action || null
  });
}
