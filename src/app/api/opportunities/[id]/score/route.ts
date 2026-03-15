import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { isDemoMode } from "@/lib/services/review-mode";
import { featureFlags } from "@/lib/config/feature-flags";
import { getV2TenantContext } from "@/lib/v2/context";
import { rescoreOpportunityV2 } from "@/lib/v2/opportunities";
import type { AccountRole } from "@/types/domain";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      {
        scored: false,
        mode: "compat",
        reason: "Enable SB_USE_V2_WRITES to score opportunities with v2 engine"
      },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  try {
    const scored = await rescoreOpportunityV2({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      opportunityId: id,
      actorUserId: context.userId
    });

    return NextResponse.json({ scored: true, opportunity: scored });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Score operation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
