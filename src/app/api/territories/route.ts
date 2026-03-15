import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { featureFlags } from "@/lib/config/feature-flags";
import { getV2TenantContext } from "@/lib/v2/context";
import { isDemoMode } from "@/lib/services/review-mode";
import type { AccountRole } from "@/types/domain";

export async function GET(req: NextRequest) {
  if (isDemoMode() || !featureFlags.useV2Reads) {
    return NextResponse.json({ territories: [], mode: "compat" });
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = req.nextUrl.searchParams.get("active");
  let query = context.supabase
    .from("v2_territories")
    .select("id,external_id,name,zip_codes,service_lines,active,capacity_json,hours_json,created_at,updated_at")
    .eq("tenant_id", context.franchiseTenantId)
    .order("name", { ascending: true })
    .limit(200);

  if (active === "true") query = query.eq("active", true);
  if (active === "false") query = query.eq("active", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ territories: data || [] });
}

export async function POST(req: NextRequest) {
  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json({ ok: false, mode: "compat", reason: "Enable SB_USE_V2_WRITES for v2 territories" }, { status: 202 });
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const body = (await req.json().catch(() => ({}))) as {
    externalId?: string;
    name?: string;
    zipCodes?: string[];
    serviceLines?: string[];
    active?: boolean;
    capacity?: Record<string, unknown>;
    hours?: Record<string, unknown>;
  };

  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const payload = {
    tenant_id: context.franchiseTenantId,
    external_id: body.externalId ? String(body.externalId).trim() : null,
    name,
    zip_codes: Array.isArray(body.zipCodes) ? body.zipCodes.map((zip) => String(zip).trim()).filter(Boolean) : [],
    service_lines: Array.isArray(body.serviceLines) ? body.serviceLines.map((line) => String(line).trim()).filter(Boolean) : [],
    active: body.active !== false,
    capacity_json: body.capacity || {},
    hours_json: body.hours || {}
  };

  const { data, error } = await context.supabase
    .from("v2_territories")
    .insert(payload)
    .select("id,external_id,name,zip_codes,service_lines,active,capacity_json,hours_json,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ territory: data }, { status: 201 });
}
