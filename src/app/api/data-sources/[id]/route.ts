import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { isDemoMode } from "@/lib/services/review-mode";
import {
  buildDataSourceUpdatePayload,
  fetchDataSourceRow,
  getDataSourceSummary
} from "@/lib/v2/data-sources";
import { getV2TenantContext } from "@/lib/v2/context";
import type { AccountRole } from "@/types/domain";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      {
        ok: false,
        mode: "compat",
        reason: "Enable SB_USE_V2_WRITES to update data sources"
      },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const { id } = await params;
  const sourceId = String(id || "").trim();
  if (!sourceId) return NextResponse.json({ error: "Source id is required" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Parameters<typeof buildDataSourceUpdatePayload>[0];

  try {
    const sourceRow = await fetchDataSourceRow({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      sourceId
    });

    const existingConfig = sourceRow && typeof sourceRow.config_encrypted === "object" && !Array.isArray(sourceRow.config_encrypted)
      ? (sourceRow.config_encrypted as Record<string, unknown>)
      : {};

    const payload = buildDataSourceUpdatePayload(body, existingConfig);
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    const { data, error } = await context.supabase
      .from("v2_data_sources")
      .update(payload)
      .eq("tenant_id", context.franchiseTenantId)
      .eq("id", sourceId)
      .select("id,tenant_id,source_type,name,status,terms_status,provenance,reliability_score,freshness_timestamp,rate_limit_policy,compliance_flags,config_encrypted,compliance_status,created_at,updated_at")
      .maybeSingle();

    if (error || !data?.id) {
      return NextResponse.json({ error: error?.message || "Source not found" }, { status: 404 });
    }

    const sourceSummary = await getDataSourceSummary({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      sourceId
    });

    return NextResponse.json({
      source: sourceSummary,
      row: data
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
