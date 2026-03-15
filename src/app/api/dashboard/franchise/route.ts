import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import { getFranchiseDashboardReadModel } from "@/lib/v2/dashboard-read-models";
import type { AccountRole } from "@/types/domain";

export async function GET() {
  if (isDemoMode() || !featureFlags.useV2Reads) {
    return NextResponse.json({ mode: "compat", metrics: [], opportunities: [], assignments: [], jobs: [] });
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH", "READ_ONLY"]);

  try {
    const data = await getFranchiseDashboardReadModel({
      supabase: context.supabase,
      franchiseTenantId: context.franchiseTenantId
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Franchise dashboard read model failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
