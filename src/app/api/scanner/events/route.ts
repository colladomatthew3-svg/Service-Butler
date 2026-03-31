import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { listDemoScannerEvents } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";
import { getOpportunityQualificationSnapshot } from "@/lib/v2/opportunity-qualification";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function GET(req: NextRequest) {
  if (isDemoMode()) {
    const source = req.nextUrl.searchParams.get("source");
    const category = req.nextUrl.searchParams.get("category");
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
    const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    return NextResponse.json({
      events: listDemoScannerEvents({ source, category, limit, query: q })
    });
  }

  const { accountId, supabase } = await getCurrentUserContext();
  const source = req.nextUrl.searchParams.get("source");
  const category = req.nextUrl.searchParams.get("category");
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  let query = supabase
    .from("scanner_events")
    .select("id,source,category,title,description,location_text,lat,lon,intent_score,confidence,tags,raw,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (source && source !== "all") query = query.eq("source", source);
  if (category && category !== "all") query = query.eq("category", category);
  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location_text.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    const message = String(error.message || "");
    const missingScannerTable =
      message.includes("scanner_events") &&
      (message.includes("schema cache") || message.includes("does not exist") || message.includes("not found"));
    if (missingScannerTable) {
      return NextResponse.json({
        events: [],
        warning: "Scanner events table is unavailable locally. Run migrations to enable persisted feed."
      });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const events: Array<Record<string, unknown>> = ((data || []) as Array<Record<string, unknown>>).map((event) => ({
    ...event,
    raw: asRecord(event.raw)
  }));

  if (!featureFlags.useV2Reads || events.length === 0) {
    return NextResponse.json({ events });
  }

  const { data: tenantMap } = await supabase
    .from("v2_account_tenant_map")
    .select("franchise_tenant_id")
    .eq("account_id", accountId)
    .maybeSingle();

  const franchiseTenantId = String(tenantMap?.franchise_tenant_id || "").trim();
  if (!franchiseTenantId) {
    return NextResponse.json({ events });
  }

  const { data: opportunityRows } = await supabase
    .from("v2_opportunities")
    .select("id,lifecycle_status,contact_status,explainability_json,created_at")
    .eq("tenant_id", franchiseTenantId)
    .order("created_at", { ascending: false })
    .limit(Math.max(150, limit * 6));

  const qualificationByScannerEventId = new Map<
    string,
    {
      opportunityId: string;
      qualificationStatus: string;
      qualificationReasonCode: string | null;
      proofAuthenticity: string;
      nextRecommendedAction: string;
      researchOnly: boolean;
      requiresSdrQualification: boolean;
      contactName: string | null;
      phone: string | null;
      email: string | null;
      verificationStatus: string | null;
      qualificationSource: string | null;
      qualificationNotes: string | null;
      qualifiedAt: string | null;
      qualifiedBy: string | null;
    }
  >();

  for (const row of (opportunityRows || []) as Array<Record<string, unknown>>) {
    const explainability = asRecord(row.explainability_json);
    const qualification = getOpportunityQualificationSnapshot({
      explainability,
      lifecycleStatus: row.lifecycle_status,
      contactStatus: row.contact_status
    });
    const candidateKeys = Array.from(
      new Set(
        [qualification.scannerEventId, String(explainability.scanner_event_id || "").trim(), String(explainability.scanner_opportunity_id || "").trim()].filter(
          (value): value is string => Boolean(value)
        )
      )
    );
    if (candidateKeys.length === 0) continue;
    for (const key of candidateKeys) {
      if (qualificationByScannerEventId.has(key)) continue;
      qualificationByScannerEventId.set(key, {
        opportunityId: String(row.id),
        qualificationStatus: qualification.qualificationStatus,
        qualificationReasonCode: qualification.qualificationReasonCode,
        proofAuthenticity: qualification.proofAuthenticity,
        nextRecommendedAction: qualification.nextRecommendedAction,
        researchOnly: qualification.researchOnly,
        requiresSdrQualification: qualification.requiresSdrQualification,
        contactName: qualification.contactName,
        phone: qualification.phone,
        email: qualification.email,
        verificationStatus: qualification.verificationStatus,
        qualificationSource: qualification.qualificationSource,
        qualificationNotes: qualification.qualificationNotes,
        qualifiedAt: qualification.qualifiedAt,
        qualifiedBy: qualification.qualifiedBy
      });
    }
  }

  return NextResponse.json({
    events: events.map((event) => {
      const raw = asRecord(event.raw);
      const qualification =
        qualificationByScannerEventId.get(String(raw.scanner_opportunity_id || "").trim()) ||
        qualificationByScannerEventId.get(String(event.id || "").trim());
      if (!qualification) return event;
      return {
        ...event,
        raw: {
          ...raw,
          v2_opportunity_id: qualification.opportunityId,
          qualification_status: qualification.qualificationStatus,
          qualification_reason_code: qualification.qualificationReasonCode,
          proof_authenticity: qualification.proofAuthenticity,
          next_recommended_action: qualification.nextRecommendedAction,
          research_only: qualification.researchOnly,
          requires_sdr_qualification: qualification.requiresSdrQualification,
          contact_name: qualification.contactName,
          phone: qualification.phone,
          email: qualification.email,
          verification_status: qualification.verificationStatus,
          qualification_source: qualification.qualificationSource,
          qualification_notes: qualification.qualificationNotes,
          qualified_at: qualification.qualifiedAt,
          qualified_by: qualification.qualifiedBy
        }
      };
    })
  });
}
