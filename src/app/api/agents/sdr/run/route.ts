import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import { runSdrAgentV2 } from "@/lib/v2/sdr-agent";
import type { AccountRole } from "@/types/domain";

export async function POST(req: NextRequest) {
  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      {
        ok: false,
        mode: "compat",
        reason: "Enable SB_USE_V2_WRITES to run SDR agent in v2 mode"
      },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const body = (await req.json().catch(() => ({}))) as {
    sourceIds?: string[];
    maxSources?: number;
    maxOpportunities?: number;
    maxLeadsToCreate?: number;
    minJobLikelihood?: number;
    minUrgency?: number;
    minSourceReliability?: number;
    minVerificationScore?: number;
    runConnectors?: boolean;
    autoRoute?: boolean;
    autoOutreach?: boolean;
    enableEnrichment?: boolean;
    dryRun?: boolean;
    dualWriteLegacy?: boolean;
  };

  try {
    const result = await runSdrAgentV2({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      enterpriseTenantId: context.enterpriseTenantId,
      actorUserId: context.userId,
      sourceIds: Array.isArray(body.sourceIds) ? body.sourceIds : undefined,
      maxSources: body.maxSources,
      maxOpportunities: body.maxOpportunities,
      maxLeadsToCreate: body.maxLeadsToCreate,
      minJobLikelihood: body.minJobLikelihood,
      minUrgency: body.minUrgency,
      minSourceReliability: body.minSourceReliability,
      minVerificationScore: body.minVerificationScore,
      runConnectors: body.runConnectors ?? true,
      autoRoute: body.autoRoute ?? true,
      autoOutreach: body.autoOutreach ?? false,
      enableEnrichment: body.enableEnrichment ?? true,
      dryRun: body.dryRun ?? false,
      dualWriteLegacy: body.dualWriteLegacy ?? true
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SDR agent failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

