import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import { getFranchiseDashboardReadModel } from "@/lib/v2/dashboard-read-models";
import type { AccountRole } from "@/types/domain";

export async function GET() {
  if (isDemoMode() || !featureFlags.useV2Reads) {
    return NextResponse.json({
      mode: "compat",
      metrics: [],
      opportunities: [],
      assignments: [],
      jobs: [],
      lead_quality_proof: {
        verified_lead_count: 0,
        review_lead_count: 0,
        rejected_lead_count: 0,
        contactable_lead_count: 0,
        booked_jobs_from_verified_leads: 0,
        booked_jobs_from_review_leads: 0,
        source_quality_preview: [],
        proof_samples: []
      }
    });
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
