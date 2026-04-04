import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { isDemoMode, resolveReviewAccountId } from "@/lib/services/review-mode";
import { isSyntheticScannerRecord } from "@/lib/services/scanner-truth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOpportunityQualificationSnapshot } from "@/lib/v2/opportunity-qualification";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

type ScannerEventRow = Record<string, unknown> & {
  id?: unknown;
  source?: unknown;
  raw?: Record<string, unknown>;
};

async function resolveOperationalAccountId(supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"]) {
  const operatorTenantId = String(process.env.OPERATOR_TENANT_ID || "").trim();
  if (operatorTenantId) {
    const { data: map } = await supabase
      .from("v2_account_tenant_map")
      .select("account_id")
      .eq("franchise_tenant_id", operatorTenantId)
      .limit(1)
      .maybeSingle();
    if (map?.account_id) return String(map.account_id);
  }

  const { data: account } = await supabase.from("accounts").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return String(account?.id || "");
}

function classifyCategory(raw: Record<string, unknown>) {
  const haystack = String(
    raw.category ||
      raw.source_lane ||
      raw.opportunity_type ||
      raw.service_type ||
      raw.demand_signal ||
      raw.signal_source ||
      ""
  )
    .toLowerCase()
    .trim();
  if (haystack.includes("plumb") || haystack.includes("freeze") || haystack.includes("pipe") || haystack.includes("sewer")) return "plumbing";
  if (haystack.includes("asbestos") || haystack.includes("hazmat") || haystack.includes("smoke")) return "asbestos";
  if (haystack.includes("demo") || haystack.includes("collapse") || haystack.includes("board-up") || haystack.includes("fire")) return "demolition";
  if (haystack.includes("restor") || haystack.includes("flood") || haystack.includes("storm") || haystack.includes("water")) return "restoration";
  return "general";
}

export async function GET(req: NextRequest) {
  const context = await getCurrentUserContext();
  const { role } = context;
  let { accountId, supabase } = context;
  if (!supabase && isDemoMode()) {
    supabase = getSupabaseAdminClient() as typeof supabase;
    const resolved = await resolveOperationalAccountId(supabase);
    accountId = resolved || (await resolveReviewAccountId());
  }
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

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
  let scannerFeedWarning: string | undefined;
  let scannerRows = data || [];
  if (error) {
    const message = String(error.message || "");
    const missingScannerTable =
      message.includes("scanner_events") &&
      (message.includes("schema cache") || message.includes("does not exist") || message.includes("not found"));
    if (missingScannerTable) {
      scannerFeedWarning = "Scanner events table is unavailable; showing persisted v2 opportunities when available.";
      scannerRows = [];
    } else {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const filteredSyntheticCount = (scannerRows as Array<Record<string, unknown>>).filter((event) =>
    isSyntheticScannerRecord({ source: event.source, raw: event.raw })
  ).length;
  const events: ScannerEventRow[] = (scannerRows as Array<Record<string, unknown>>)
    .map((event): ScannerEventRow => ({
      ...event,
      raw: asRecord(event.raw)
    }))
    .filter((event) => !isSyntheticScannerRecord({ source: event.source, raw: event.raw }));

  if (featureFlags.useV2Reads && events.length === 0) {
    const { data: tenantMap } = await supabase
      .from("v2_account_tenant_map")
      .select("franchise_tenant_id")
      .eq("account_id", accountId)
      .maybeSingle();

    const franchiseTenantId = String(tenantMap?.franchise_tenant_id || "").trim();
    if (franchiseTenantId) {
      const { data: opportunityRows, error: opportunityError } = await supabase
        .from("v2_opportunities")
        .select("id,lifecycle_status,contact_status,explainability_json,created_at")
        .eq("tenant_id", franchiseTenantId)
        .order("created_at", { ascending: false })
        .limit(Math.max(150, limit * 6));
      if (!opportunityError) {
        const v2Events: ScannerEventRow[] = ((opportunityRows || []) as Array<Record<string, unknown>>)
          .map((row) => {
            const explainability = asRecord(row.explainability_json);
            const sourceType = String(explainability.source_type || explainability.source || "public_feed");
            const qualification = getOpportunityQualificationSnapshot({
              explainability,
              lifecycleStatus: row.lifecycle_status,
              contactStatus: row.contact_status
            });
            const title = String(
              explainability.signal_title ||
                explainability.title ||
                explainability.event_title ||
                explainability.demand_signal ||
                "Captured opportunity"
            ).trim();
            const description = String(
              explainability.signal_description ||
                explainability.description ||
                explainability.demand_explanation ||
                "Live public signal captured for qualification."
            ).trim();
            const city = String(explainability.property_city || explainability.city || "").trim();
            const state = String(explainability.property_state || explainability.state || "").trim();
            const postal = String(explainability.property_postal_code || explainability.postal_code || "").trim();
            const locationText = [city, state, postal].filter(Boolean).join(", ") || String(explainability.service_area_label || "Service Area");
            const intentScore = Number(explainability.intent_score || explainability.priority_score || 60);
            const confidence = Number(explainability.confidence || 68);
            const raw = {
              ...explainability,
              scanner_opportunity_id: String(row.id || ""),
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
            };
            return {
              id: String(row.id || ""),
              source: sourceType,
              category: classifyCategory(raw),
              title,
              description,
              location_text: locationText,
              lat: typeof explainability.lat === "number" ? explainability.lat : null,
              lon: typeof explainability.lon === "number" ? explainability.lon : null,
              intent_score: Number.isFinite(intentScore) ? intentScore : 60,
              confidence: Number.isFinite(confidence) ? confidence : 68,
              tags: Array.isArray(explainability.tags) ? explainability.tags : [],
              raw,
              created_at: String(row.created_at || new Date().toISOString())
            } satisfies ScannerEventRow;
          })
          .filter((event) => !isSyntheticScannerRecord({ source: event.source, raw: event.raw }))
          .slice(0, limit);

        return NextResponse.json({
          events: v2Events,
          warning:
            scannerFeedWarning ||
            (v2Events.length === 0 ? "No persisted live scanner opportunities matched this filter yet." : "Showing live persisted opportunities from v2 truth store.")
        });
      }
    }
  }

  if (!featureFlags.useV2Reads || events.length === 0) {
    return NextResponse.json({
      events,
      warning:
        scannerFeedWarning ||
        (filteredSyntheticCount > 0
          ? `${filteredSyntheticCount} synthetic scanner record${filteredSyntheticCount === 1 ? "" : "s"} were hidden.`
          : undefined)
    });
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
    }),
    warning:
      scannerFeedWarning ||
      (filteredSyntheticCount > 0 ? `${filteredSyntheticCount} synthetic scanner record${filteredSyntheticCount === 1 ? "" : "s"} were hidden.` : undefined)
  });
}
