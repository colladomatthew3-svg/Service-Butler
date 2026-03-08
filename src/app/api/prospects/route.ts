import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { createDemoProspect, listDemoProspects } from "@/lib/demo/store";
import { buildTerritory, cleanNumber, cleanText, normalizeTagList, parseBooleanFlag } from "@/lib/services/outbound";
import { isDemoMode } from "@/lib/services/review-mode";

function mapProspectRow(row: Record<string, unknown>, territoryFallback?: string | null) {
  const city = cleanText(row.city);
  const state = cleanText(row.state);
  return {
    company_name: cleanText(row.company_name) || cleanText(row.name) || "New Prospect",
    contact_name: cleanText(row.contact_name),
    title: cleanText(row.title),
    email: cleanText(row.email),
    phone: cleanText(row.phone),
    website: cleanText(row.website),
    city,
    state,
    zip: cleanText(row.zip) || cleanText(row.postal_code),
    territory: cleanText(row.territory) || territoryFallback || buildTerritory([city, state]),
    prospect_type: cleanText(row.prospect_type) || cleanText(row.segment) || "property_manager",
    property_type: cleanText(row.property_type),
    building_count: cleanNumber(row.building_count),
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
  const segment = cleanText(req.nextUrl.searchParams.get("segment"));
  const search = cleanText(req.nextUrl.searchParams.get("search"));
  const nearIncident = parseBooleanFlag(req.nextUrl.searchParams.get("nearIncident"));

  if (isDemoMode()) {
    const prospects = listDemoProspects({ territory, segment, search, nearIncident });
    return NextResponse.json({ prospects });
  }

  const { accountId, supabase } = await getCurrentUserContext();
  let query = supabase.from("prospects").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).limit(250);

  if (territory && territory !== "all") query = query.eq("territory", territory);
  if (segment && segment !== "all") query = query.eq("prospect_type", segment);
  if (nearIncident != null) query = query.eq("near_active_incident", nearIncident);
  if (search) query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,city.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ prospects: data || [] });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { rows?: Record<string, unknown>[] } & Record<string, unknown>;
  const rows = Array.isArray(body.rows) ? body.rows : [body];

  if (isDemoMode()) {
    const created = rows.map((row) => createDemoProspect(mapProspectRow(row))).filter(Boolean);
    return NextResponse.json({ prospects: created });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const cleaned = rows.map((row) => ({ account_id: accountId, ...mapProspectRow(row) })).filter((row) => row.company_name);
  if (cleaned.length === 0) return NextResponse.json({ error: "No valid prospects supplied" }, { status: 400 });

  const { data, error } = await supabase.from("prospects").insert(cleaned).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ prospects: data || [] });
}
