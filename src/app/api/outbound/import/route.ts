import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { createDemoProspect } from "@/lib/demo/store";
import { buildTerritory } from "@/lib/services/outbound";
import { isDemoMode } from "@/lib/services/review-mode";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    rows?: Array<{
      name?: string;
      phone?: string;
      email?: string;
      service_type?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      tags?: string[];
    }>;
  };

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ error: "No rows supplied" }, { status: 400 });

  const cleaned = rows
    .map((row) => ({
      name: String(row.name || "").trim(),
      phone: row.phone ? String(row.phone).trim() : null,
      email: row.email ? String(row.email).trim() : null,
      service_type: row.service_type ? String(row.service_type).trim() : null,
      city: row.city ? String(row.city).trim() : null,
      state: row.state ? String(row.state).trim() : null,
      postal_code: row.postal_code ? String(row.postal_code).trim() : null,
      tags: Array.isArray(row.tags) ? row.tags.slice(0, 12).map((tag) => String(tag).trim()).filter(Boolean) : [],
      source: "csv"
    }))
    .filter((row) => row.name.length > 0);

  if (cleaned.length === 0) return NextResponse.json({ error: "All rows were empty" }, { status: 400 });

  if (isDemoMode()) {
    for (const row of cleaned) {
      createDemoProspect({
        company_name: row.name,
        contact_name: row.name,
        email: row.email,
        phone: row.phone,
        city: row.city,
        state: row.state,
        zip: row.postal_code,
        territory: buildTerritory([row.city, row.state]),
        prospect_type: row.service_type || "property_manager",
        tags: row.tags,
        source: row.source
      });
    }
    return NextResponse.json({ inserted: cleaned.length });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const scoped = cleaned.map((row) => ({ ...row, account_id: accountId }));

  const [{ error }, { error: prospectError }] = await Promise.all([
    supabase.from("outbound_contacts").insert(scoped),
    supabase.from("prospects").insert(
      scoped.map((row) => ({
        account_id: accountId,
        company_name: row.name,
        contact_name: row.name,
        email: row.email,
        phone: row.phone,
        city: row.city,
        state: row.state,
        zip: row.postal_code,
        territory: buildTerritory([row.city, row.state]),
        prospect_type: row.service_type || "property_manager",
        tags: row.tags,
        source: row.source
      }))
    )
  ]);
  if (error || prospectError) return NextResponse.json({ error: error?.message || prospectError?.message }, { status: 400 });

  return NextResponse.json({ inserted: scoped.length });
}
