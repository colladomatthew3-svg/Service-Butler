import { NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { hasVerifiedOwnerContact } from "@/lib/services/contact-proof";
import { isSyntheticScannerRecord } from "@/lib/services/scanner-truth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoMode, resolveReviewAccountId } from "@/lib/services/review-mode";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isQualifiedContactable(raw: Record<string, unknown>) {
  const status = asText(raw.qualification_status);
  if (status !== "qualified_contactable") return false;

  const verificationStatus = asText(raw.verification_status);
  const phone = String(raw.phone || "").trim();
  const email = String(raw.email || "").trim();
  return verificationStatus === "verified" && Boolean(phone || email);
}

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

export async function GET() {
  const context = await getCurrentUserContext();
  const { role } = context;
  let { accountId, supabase } = context;
  if (!supabase && isDemoMode()) {
    supabase = getSupabaseAdminClient() as typeof supabase;
    const resolved = await resolveOperationalAccountId(supabase);
    accountId = resolved || (await resolveReviewAccountId());
  }
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const operatorTenantId = String(process.env.OPERATOR_TENANT_ID || "").trim();
  let tenantId = operatorTenantId;
  if (!tenantId) {
    const { data: tenantMap } = await supabase
      .from("v2_account_tenant_map")
      .select("franchise_tenant_id")
      .eq("account_id", accountId)
      .limit(1)
      .maybeSingle();
    tenantId = String(tenantMap?.franchise_tenant_id || "").trim();
  }

  const [{ data: scannerRows, error: scannerError }, { count: leadCount, error: leadError }, v2OpportunityResult, v2LeadResult] = await Promise.all([
    supabase
      .from("scanner_events")
      .select("id,source,raw,created_at")
      .eq("account_id", accountId)
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("source", "scanner_verified_contact")
      .gte("created_at", since24h),
    tenantId
      ? supabase
          .from("v2_opportunities")
          .select("id,contact_status,lifecycle_status,created_at,explainability_json")
          .eq("tenant_id", tenantId)
          .gte("created_at", since24h)
          .order("created_at", { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
    tenantId
      ? supabase
          .from("v2_leads")
          .select("id,created_at,contact_channels_json,opportunity_id")
          .eq("tenant_id", tenantId)
          .gte("created_at", since24h)
          .order("created_at", { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (scannerError) {
    const message = String(scannerError.message || "");
    if (message.includes("scanner_events")) {
      return NextResponse.json({
        window_hours: 24,
        captured_real_signals: 0,
        qualified_contactable_signals: 0,
        research_only_signals: 0,
        scanner_verified_leads_created: 0,
        warning: "scanner_events table is unavailable, so throughput metrics are limited."
      });
    }
    return NextResponse.json({ error: scannerError.message || "Failed loading scanner throughput." }, { status: 500 });
  }

  if (leadError) {
    return NextResponse.json({ error: leadError.message || "Failed loading lead throughput." }, { status: 500 });
  }
  if (v2OpportunityResult.error) {
    return NextResponse.json({ error: v2OpportunityResult.error.message || "Failed loading v2 opportunity throughput." }, { status: 500 });
  }
  if (v2LeadResult.error) {
    return NextResponse.json({ error: v2LeadResult.error.message || "Failed loading v2 lead throughput." }, { status: 500 });
  }

  const rows = (scannerRows || []).filter((row) => !isSyntheticScannerRecord({ source: row.source, raw: row.raw }));
  const qualified = rows.filter((row) => {
    const raw = asRecord(row.raw);
    return hasVerifiedOwnerContact(raw.enrichment) || isQualifiedContactable(raw);
  });
  const researchOnly = rows.filter((row) => {
    const raw = asRecord(row.raw);
    return asText(raw.qualification_status) === "research_only";
  });
  const v2OpportunityRows = (v2OpportunityResult.data || []) as Array<{
    explainability_json?: Record<string, unknown> | null;
    contact_status?: string | null;
    lifecycle_status?: string | null;
  }>;
  const v2ScannerRows = v2OpportunityRows.filter((row) => {
    const explainability = asRecord(row.explainability_json);
    const hasScannerId = Boolean(String(explainability.scanner_event_id || explainability.scanner_opportunity_id || "").trim());
    const sourceType = asText(explainability.source_type);
    return hasScannerId || sourceType.includes("scanner");
  });
  const v2Qualified = v2ScannerRows.filter((row) => {
    const explainability = asRecord(row.explainability_json);
    return (
      isQualifiedContactable(explainability) ||
      (asText(row.contact_status) === "identified" && asText(explainability.verification_status) === "verified")
    );
  });
  const v2ResearchOnly = v2ScannerRows.filter((row) => {
    const explainability = asRecord(row.explainability_json);
    return asText(explainability.qualification_status) === "research_only";
  });
  const v2Leads = (v2LeadResult.data || []) as Array<{ contact_channels_json?: Record<string, unknown> | null }>;
  const v2VerifiedLeadCount = v2Leads.filter((lead) => {
    const channels = asRecord(lead.contact_channels_json);
    const verificationStatus = asText(channels.verification_status);
    const verificationScore = Number(channels.verification_score || 0);
    const hasContact = Boolean(String(channels.phone || "").trim() || String(channels.email || "").trim());
    return hasContact && (verificationStatus === "verified" || verificationScore >= 70);
  }).length;

  const capturedRealSignals = rows.length > 0 ? rows.length : v2ScannerRows.length;
  const qualifiedContactableSignals = qualified.length > 0 ? qualified.length : v2Qualified.length;
  const researchOnlySignals = researchOnly.length > 0 ? researchOnly.length : v2ResearchOnly.length;
  const scannerVerifiedLeadsCreated = Math.max(Number(leadCount || 0), v2VerifiedLeadCount);

  return NextResponse.json({
    window_hours: 24,
    captured_real_signals: capturedRealSignals,
    qualified_contactable_signals: qualifiedContactableSignals,
    research_only_signals: researchOnlySignals,
    scanner_verified_leads_created: scannerVerifiedLeadsCreated
  });
}
