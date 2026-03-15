#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PILOT = {
  enterpriseName: "SERVPRO_CORP",
  enterpriseBrand: "SERVPRO",
  franchises: [
    {
      name: "SERVPRO_NY_001",
      externalId: "SERVPRO_NY_001_MAIN",
      zipCodes: ["10001", "10002", "10003", "10010"],
      polygon: "SRID=4326;MULTIPOLYGON(((-74.0200 40.7000,-73.9300 40.7000,-73.9300 40.7900,-74.0200 40.7900,-74.0200 40.7000)))"
    },
    {
      name: "SERVPRO_NY_002",
      externalId: "SERVPRO_NY_002_MAIN",
      zipCodes: ["11201", "11205", "11215", "11217"],
      polygon: "SRID=4326;MULTIPOLYGON(((-74.0400 40.6500,-73.9000 40.6500,-73.9000 40.7400,-74.0400 40.7400,-74.0400 40.6500)))"
    }
  ]
};

const SERVICE_LINES = ["restoration", "plumbing", "hvac", "general"];

function roleForIndex(index) {
  if (index === 0) return "ENTERPRISE_ADMIN";
  if (index === 1) return "REGIONAL_MANAGER";
  return "DISPATCHER";
}

async function upsertTenant({ type, name, brand, parentTenantId = null }) {
  const payload = {
    type,
    name,
    brand,
    parent_tenant_id: parentTenantId,
    status: "active",
    settings_json: {
      seeded_by: "seed-pilot-tenants.mjs",
      seeded_at: new Date().toISOString()
    }
  };

  const { data, error } = await supabase
    .from("v2_tenants")
    .upsert(payload, { onConflict: "type,name" })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || `Failed to upsert tenant ${name}`);
  }

  return String(data.id);
}

async function upsertTerritory({ tenantId, externalId, name, zipCodes, polygon }) {
  const { data: existing, error: existingError } = await supabase
    .from("v2_territories")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const payload = {
    tenant_id: tenantId,
    external_id: externalId,
    name,
    geometry: polygon,
    zip_codes: zipCodes,
    service_lines: SERVICE_LINES,
    capacity_json: { open_slots: 15, max_active_assignments: 45 },
    hours_json: { timezone: "America/New_York", open: "08:00", close: "20:00" },
    active: true
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("v2_territories")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return String(existing.id);
  }

  const { data: inserted, error } = await supabase
    .from("v2_territories")
    .insert(payload)
    .select("id")
    .single();

  if (error || !inserted?.id) throw new Error(error?.message || `Failed creating territory ${name}`);
  return String(inserted.id);
}

async function upsertTerritoryVersion({ territoryId, polygon, zipCodes }) {
  const payload = {
    territory_id: territoryId,
    version_no: 1,
    geometry: polygon,
    zip_codes: zipCodes,
    service_lines: SERVICE_LINES,
    changed_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("v2_territory_versions")
    .upsert(payload, { onConflict: "territory_id,version_no" });

  if (error) throw new Error(error.message);
}

async function upsertRoutingRule({ tenantId, territoryId }) {
  const { data: existing, error: existingError } = await supabase
    .from("v2_routing_rules")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("territory_id", territoryId)
    .eq("service_line", "restoration")
    .eq("priority", 100)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const payload = {
    tenant_id: tenantId,
    territory_id: territoryId,
    service_line: "restoration",
    priority: 100,
    active: true,
    rule_json: {
      kind: "service_line_default",
      sla_minutes: 45,
      escalation_mode: "enterprise_fallback"
    }
  };

  if (existing?.id) {
    const { error } = await supabase.from("v2_routing_rules").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("v2_routing_rules").insert(payload);
  if (error) throw new Error(error.message);
}

async function upsertDataSources({ tenantId }) {
  const rows = [
    {
      tenant_id: tenantId,
      source_type: "weather",
      name: "NOAA Weather Feed",
      status: "active",
      terms_status: "approved",
      reliability_score: 86,
      provenance: "api.weather.gov",
      freshness_timestamp: new Date().toISOString(),
      rate_limit_policy: { requests_per_minute: 30 },
      compliance_flags: { approved: true }
    },
    {
      tenant_id: tenantId,
      source_type: "permits",
      name: "Municipal Permits Feed",
      status: "active",
      terms_status: "approved",
      reliability_score: 74,
      provenance: "pilot.permits.provider",
      freshness_timestamp: new Date().toISOString(),
      rate_limit_policy: { requests_per_minute: 15 },
      compliance_flags: { approved: true }
    },
    {
      tenant_id: tenantId,
      source_type: "social",
      name: "Social Intent Placeholder",
      status: "active",
      terms_status: "pending_review",
      reliability_score: 45,
      provenance: "placeholder.social",
      freshness_timestamp: new Date().toISOString(),
      rate_limit_policy: { requests_per_minute: 10 },
      compliance_flags: { approved: false }
    }
  ];

  for (const row of rows) {
    const { data: existing, error: existingError } = await supabase
      .from("v2_data_sources")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", row.name)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing?.id) {
      const { error } = await supabase.from("v2_data_sources").update(row).eq("id", existing.id);
      if (error) throw new Error(error.message);
      continue;
    }

    const { error } = await supabase.from("v2_data_sources").insert(row);
    if (error) throw new Error(error.message);
  }
}

async function discoverPilotUsers() {
  const fromEnv = String(process.env.PILOT_MEMBER_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  const { data, error } = await supabase
    .from("account_roles")
    .select("user_id")
    .eq("is_active", true)
    .limit(5);

  if (error) throw new Error(error.message);

  return (data || [])
    .map((row) => String(row.user_id || "").trim())
    .filter(Boolean);
}

async function upsertMembership({ tenantId, userId, role }) {
  const { error } = await supabase.from("v2_tenant_memberships").upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      role,
      is_active: true
    },
    { onConflict: "tenant_id,user_id" }
  );

  if (error) throw new Error(error.message);
}

async function main() {
  console.log("Seeding pilot tenants...");

  const platformTenantId = await upsertTenant({
    type: "platform",
    name: "Service Butler Platform",
    brand: "Service Butler"
  });

  const enterpriseTenantId = await upsertTenant({
    type: "enterprise",
    name: PILOT.enterpriseName,
    brand: PILOT.enterpriseBrand,
    parentTenantId: platformTenantId
  });

  const franchiseTenantIds = [];

  for (const franchise of PILOT.franchises) {
    const tenantId = await upsertTenant({
      type: "franchise",
      name: franchise.name,
      brand: PILOT.enterpriseBrand,
      parentTenantId: enterpriseTenantId
    });

    franchiseTenantIds.push(tenantId);

    const territoryId = await upsertTerritory({
      tenantId,
      externalId: franchise.externalId,
      name: `${franchise.name} Territory`,
      zipCodes: franchise.zipCodes,
      polygon: franchise.polygon
    });

    await upsertTerritoryVersion({
      territoryId,
      polygon: franchise.polygon,
      zipCodes: franchise.zipCodes
    });

    await upsertRoutingRule({ tenantId, territoryId });
    await upsertDataSources({ tenantId });
  }

  const userIds = await discoverPilotUsers();
  if (userIds.length === 0) {
    console.warn("No pilot users discovered. Set PILOT_MEMBER_USER_IDS to seed memberships.");
  } else {
    await upsertMembership({
      tenantId: enterpriseTenantId,
      userId: userIds[0],
      role: "ENTERPRISE_ADMIN"
    });

    for (let i = 0; i < franchiseTenantIds.length; i += 1) {
      const franchiseTenantId = franchiseTenantIds[i];
      const userId = userIds[Math.min(i, userIds.length - 1)];
      await upsertMembership({
        tenantId: franchiseTenantId,
        userId,
        role: "FRANCHISE_OWNER"
      });

      const dispatcherUser = userIds[Math.min(i + 1, userIds.length - 1)] || userId;
      await upsertMembership({
        tenantId: franchiseTenantId,
        userId: dispatcherUser,
        role: roleForIndex(i + 1)
      });
    }
  }

  console.log(`Enterprise tenant: ${enterpriseTenantId}`);
  console.log(`Franchise tenants: ${franchiseTenantIds.join(", ")}`);
  console.log("Pilot tenant seed complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
