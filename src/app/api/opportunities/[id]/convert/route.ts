import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import { convertOpportunityToJobV2 } from "@/lib/v2/opportunity-conversion";
import type { AccountRole } from "@/types/domain";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      { converted: false, mode: "compat", reason: "Enable SB_USE_V2_WRITES to convert v2 opportunities to jobs" },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  try {
    const result = await convertOpportunityToJobV2({
      supabase: context.supabase as never,
      tenantId: context.franchiseTenantId,
      opportunityId: id,
      actorUserId: context.userId
    });

    return NextResponse.json({
      converted: true,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not convert opportunity to job";
    const status = message.includes("requires review") ? 409 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
