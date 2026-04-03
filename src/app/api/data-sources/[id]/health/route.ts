import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { buildDataSourceReadinessState, buildEnvironmentReadinessState } from "@/lib/control-plane/readiness";
import { getDataSourceSummaryById } from "@/lib/control-plane/data-sources";
import { isDemoMode } from "@/lib/services/review-mode";
import { probeDataSourceHealth } from "@/lib/v2/data-sources";
import { getV2TenantContext } from "@/lib/v2/context";
import type { AccountRole } from "@/types/domain";

export async function POST(req: NextRequest, contextArg: { params: Promise<{ id: string }> }) {
  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      {
        ok: false,
        mode: "compat",
        reason: "Enable SB_USE_V2_WRITES to probe data source health",
        readiness: buildEnvironmentReadinessState(
          "Health probes are not live in this environment.",
          "Enable SB_USE_V2_WRITES and use a tenant-mapped live account before running connector health checks."
        )
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
    const sourceSummary = await getDataSourceSummaryById({
      supabase: context.supabase as never,
      tenantId: context.franchiseTenantId,
      sourceId
    });

    if (!sourceSummary) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const readiness = buildDataSourceReadinessState(sourceSummary);
    if (
      !sourceSummary.configured ||
      sourceSummary.status === "not_configured" ||
      readiness.blockingIssues.some((entry) => entry.code === "blocked_by_terms" || entry.code === "not_live_in_environment")
    ) {
      return NextResponse.json(
        {
          ok: false,
          reason: readiness.reason,
          readiness
        },
        { status: 409 }
      );
    }

    const result = await probeDataSourceHealth({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      sourceId,
      connectorKeyOverride: String(body.connectorKey || "").trim() || undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health probe failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
