import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { isDemoMode } from "@/lib/services/review-mode";
import { featureFlags } from "@/lib/config/feature-flags";
import { getV2TenantContext } from "@/lib/v2/context";
import { transitionAssignmentV2 } from "@/lib/v2/routing-engine";
import type { AccountRole } from "@/types/domain";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      { ok: false, mode: "compat", reason: "Enable SB_USE_V2_WRITES to accept assignments in v2" },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  try {
    const assignment = await transitionAssignmentV2({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      assignmentId: id,
      action: "accept",
      actorUserId: context.userId
    });

    return NextResponse.json({ ok: true, assignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assignment accept failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
