import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { createDemoReferralPartner, listDemoReferralPartners } from "@/lib/demo/store";
import { buildTerritory, cleanNumber, cleanText, normalizeTagList, parseBooleanFlag } from "@/lib/services/outbound";
import { isDemoMode } from "@/lib/services/review-mode";

function mapPartnerRow(row: Record<string, unknown>, territoryFallback?: string | null) {
  const city = cleanText(row.city);
  const state = cleanText(row.state);
  return {
    company_name: cleanText(row.company_name) || cleanText(row.name) || "New Referral Partner",
    contact_name: cleanText(row.contact_name),
    title: cleanText(row.title),
    email: cleanText(row.email),
    phone: cleanText(row.phone),
    website: cleanText(row.website),
    city,
    state,
    zip: cleanText(row.zip) || cleanText(row.postal_code),
    territory: cleanText(row.territory) || territoryFallback || buildTerritory([city, state]),
    partner_type: cleanText(row.partner_type) || cleanText(row.segment) || "insurance_agent",
    priority_tier: cleanText(row.priority_tier) || "standard",
    strategic_value: cleanNumber(row.strategic_value) || 50,
    near_active_incident: parseBooleanFlag(row.near_active_incident) || false,
    notes: cleanText(row.notes),
    tags: normalizeTagList(row.tags),
    source: cleanText(row.source) || "manual"
  };
}

export async function GET(req: NextRequest) {
  const territory = cleanText(req.nextUrl.searchParams.get("territory"));
  const partnerType = cleanText(req.nextUrl.searchParams.get("partnerType"));
  const search = cleanText(req.nextUrl.searchParams.get("search"));
  const nearIncident = parseBooleanFlag(req.nextUrl.searchParams.get("nearIncident"));

  if (isDemoMode()) {
    const referralPartners = listDemoReferralPartners({ territory, partnerType, search, nearIncident });
    return NextResponse.json({ referralPartners });
  }

  const { accountId, supabase } = await getCurrentUserContext();
  let query = supabase.from("referral_partners").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(250);

  if (territory && territory !== "all") query = query.eq("territory", territory);
  if (partnerType && partnerType !== "all") query = query.eq("partner_type", partnerType);
  if (nearIncident != null) query = query.eq("near_active_incident", nearIncident);
  if (search) query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,city.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ referralPartners: data || [] });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { rows?: Record<string, unknown>[] } & Record<string, unknown>;
  const rows = Array.isArray(body.rows) ? body.rows : [body];

  if (isDemoMode()) {
    const created = rows.map((row) => createDemoReferralPartner(mapPartnerRow(row))).filter(Boolean);
    return NextResponse.json({ referralPartners: created });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const cleaned = rows.map((row) => ({ account_id: accountId, ...mapPartnerRow(row) })).filter((row) => row.company_name);
  if (cleaned.length === 0) return NextResponse.json({ error: "No valid referral partners supplied" }, { status: 400 });

  const { data, error } = await supabase.from("referral_partners").insert(cleaned).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ referralPartners: data || [] });
}
