import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { getV2TenantContext } from "@/lib/v2/context";

export async function GET(req: NextRequest) {
  if (featureFlags.useV2Reads) {
    const v2Context = await getV2TenantContext().catch(() => null);
    if (v2Context) {
      const category = (req.nextUrl.searchParams.get("category") || "").trim().toLowerCase();
      const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
      const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 50));

      let query = v2Context.supabase
        .from("v2_opportunities")
        .select(
          "id,opportunity_type,service_line,title,description,location_text,postal_code,urgency_score,job_likelihood_score,contactability_score,source_reliability_score,revenue_band,catastrophe_linkage_score,routing_status,lifecycle_status,explainability_json,created_at"
        )
        .eq("tenant_id", v2Context.franchiseTenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (category && category !== "all") query = query.eq("service_line", category);

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      return NextResponse.json({
        opportunities: (data || []).map((row: Record<string, unknown>) => ({
          id: row.id,
          category: row.service_line || row.opportunity_type,
          title: row.title,
          description: row.description,
          location_text: row.location_text,
          city: null,
          state: null,
          zip: row.postal_code,
          territory: null,
          lat: null,
          lon: null,
          intent_score: row.job_likelihood_score,
          confidence: row.source_reliability_score,
          urgency_score: row.urgency_score,
          tags: [],
          suggested_action: null,
          recommended_action: null,
          status: row.lifecycle_status,
          raw: {
            revenue_band: row.revenue_band,
            routing_status: row.routing_status,
            catastrophe_linkage_score: row.catastrophe_linkage_score,
            contactability_score: row.contactability_score,
            explainability: row.explainability_json
          },
          created_at: row.created_at
        }))
      });
    }
  }

  const { accountId, supabase } = await getCurrentUserContext();
  const category = (req.nextUrl.searchParams.get("category") || "").trim().toLowerCase();
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
  const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 50));

  let query = supabase
    .from("opportunities")
    .select("id,category,title,description,location_text,city,state,zip,territory,lat,lon,intent_score,confidence,urgency_score,tags,suggested_action,recommended_action,status,raw,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category && category !== "all") query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ opportunities: data || [] });
}
