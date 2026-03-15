import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { isDemoMode } from "@/lib/services/review-mode";
import { featureFlags } from "@/lib/config/feature-flags";
import { getV2TenantContext } from "@/lib/v2/context";
import { routeOpportunityV2 } from "@/lib/v2/routing-engine";
import { inngest } from "@/lib/workflows/client";
import type { AccountRole } from "@/types/domain";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      {
        routed: false,
        mode: "compat",
        reason: "Enable SB_USE_V2_WRITES to route opportunities with v2 engine"
      },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  try {
    const result = await routeOpportunityV2({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      enterpriseTenantId: context.enterpriseTenantId,
      opportunityId: id,
      actorUserId: context.userId
    });

    await inngest.send({
      name: "v2/assignment.created",
      data: {
        tenantId: context.franchiseTenantId,
        enterpriseTenantId: context.enterpriseTenantId,
        assignmentId: result.assignment.id,
        opportunityId: id,
        slaDueAt: result.assignment.sla_due_at
      }
    });

    return NextResponse.json({
      routed: true,
      decision: result.decision,
      assignment: result.assignment
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Routing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
