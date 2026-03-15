import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import { getCorporateDashboardReadModel } from "@/lib/v2/dashboard-read-models";
import type { AccountRole } from "@/types/domain";

export async function GET() {
  if (isDemoMode() || !featureFlags.useV2Reads) {
    return NextResponse.json({ mode: "compat", metrics: [], byFranchise: [] });
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER"]);

  try {
    const data = await getCorporateDashboardReadModel({
      supabase: context.supabase,
      enterpriseTenantId: context.enterpriseTenantId
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Corporate dashboard read model failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
