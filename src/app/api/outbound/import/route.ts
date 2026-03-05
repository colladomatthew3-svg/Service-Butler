import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";

export async function POST(req: NextRequest) {
  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

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
      account_id: accountId,
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

  const { error } = await supabase.from("outbound_contacts").insert(cleaned);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ inserted: cleaned.length });
}
