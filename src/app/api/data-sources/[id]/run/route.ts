import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { isDemoMode } from "@/lib/services/review-mode";
import { runDataSourceConnector } from "@/lib/v2/data-sources";
import { getV2TenantContext } from "@/lib/v2/context";
import type { AccountRole } from "@/types/domain";

export async function POST(req: NextRequest, contextArg: { params: Promise<{ id: string }> }) {
  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      {
        ok: false,
        mode: "compat",
        reason: "Enable SB_USE_V2_WRITES to run data sources"
      },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const { id } = await contextArg.params;
  const sourceId = String(id || "").trim();
  if (!sourceId) return NextResponse.json({ error: "Source id is required" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { connectorKey?: string };

  try {
    const result = await runDataSourceConnector({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      sourceId,
      actorUserId: context.userId,
      connectorKeyOverride: String(body.connectorKey || "").trim() || undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source run failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
