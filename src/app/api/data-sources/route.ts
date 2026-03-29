/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { buildCreatePayloadFromMutation, listDataSourceSummaries } from "@/lib/control-plane/data-sources";
import type { DataSourceMutationPayload } from "@/lib/control-plane/types";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import type { AccountRole } from "@/types/domain";

export async function GET() {
  if (isDemoMode() || !featureFlags.useV2Reads) {
    const sources = await listDataSourceSummaries();
    return NextResponse.json({ mode: "compat", sources });
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH", "READ_ONLY"]);

  const sources = await listDataSourceSummaries({
    supabase: context.supabase as any,
    tenantId: context.franchiseTenantId
  });

  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      {
        ok: false,
        mode: "compat",
        reason: "Enable SB_USE_V2_WRITES to create v2 data sources"
      },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const body = (await req.json().catch(() => ({}))) as DataSourceMutationPayload;

  let payload: Record<string, unknown>;
  try {
    payload = buildCreatePayloadFromMutation(body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid data source payload" }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("v2_data_sources")
    .insert({
      tenant_id: context.franchiseTenantId,
      ...payload
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return NextResponse.json({ error: error?.message || "Could not create data source" }, { status: 400 });
  }

  const sources = await listDataSourceSummaries({
    supabase: context.supabase as any,
    tenantId: context.franchiseTenantId
  });

  return NextResponse.json({ source: sources.find((source) => source.id === String(data.id)) || null }, { status: 201 });
}
