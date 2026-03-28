import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvFromFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const cwd = process.cwd();
loadEnvFromFile(path.join(cwd, ".env.local"));
loadEnvFromFile(path.join(cwd, ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const OPERATOR_PROFILE = String(process.env.OPERATOR_PROFILE || "ny_restoration").trim().toLowerCase();
const IS_SUFFOLK_PROFILE = OPERATOR_PROFILE === "suffolk_restoration";

const OPERATOR = IS_SUFFOLK_PROFILE
  ? {
      accountName: "Suffolk Restoration Group",
      tenantName: "Suffolk Restoration Group",
      type: "franchise",
      brand: "SRG",
      settings: {
        operator_mode: true,
        support_multiple_brands: true,
        support_multiple_locations: true,
        brands: ["Suffolk Restoration Group", "Long Island Water & Fire Response"],
        locations: [
          { name: "Ronkonkoma HQ", city: "Ronkonkoma", state: "NY", postal_code: "11779" },
          { name: "Riverhead Ops", city: "Riverhead", state: "NY", postal_code: "11901" }
        ]
      }
    }
  : {
      accountName: "NY Restoration Group",
      tenantName: "NY Restoration Group",
      type: "franchise",
      brand: "NYRG",
      settings: {
        operator_mode: true,
        support_multiple_brands: true,
        support_multiple_locations: true,
        brands: ["NY Restoration Group", "NY Flood Response", "Empire Property Recovery"],
        locations: [
          { name: "Manhattan HQ", city: "New York", state: "NY", postal_code: "10001" },
          { name: "Brooklyn Branch", city: "Brooklyn", state: "NY", postal_code: "11201" }
        ]
      }
    };

const TERRITORIES = IS_SUFFOLK_PROFILE
  ? [
      {
        externalId: "SRG_SUFFOLK_WEST",
        name: "Suffolk West",
        zipCodes: ["11701", "11706", "11722", "11729", "11746", "11779", "11788"],
        serviceLines: ["restoration", "plumbing", "hvac", "general"],
        polygon: "SRID=4326;MULTIPOLYGON(((-73.4520 40.6000,-72.9300 40.6000,-72.9300 40.9100,-73.4520 40.9100,-73.4520 40.6000)))"
      },
      {
        externalId: "SRG_SUFFOLK_EAST",
        name: "Suffolk East",
        zipCodes: ["11792", "11794", "11901", "11934", "11937", "11950", "11968"],
        serviceLines: ["restoration", "plumbing", "hvac", "general"],
        polygon: "SRID=4326;MULTIPOLYGON(((-72.9300 40.6400,-71.7900 40.6400,-71.7900 41.0800,-72.9300 41.0800,-72.9300 40.6400)))"
      }
    ]
  : [
      {
        externalId: "NYRG_MANHATTAN_CORE",
        name: "Manhattan Core",
        zipCodes: ["10001", "10002", "10003", "10010"],
        serviceLines: ["restoration", "plumbing", "general"],
        polygon: "SRID=4326;MULTIPOLYGON(((-74.0200 40.7000,-73.9300 40.7000,-73.9300 40.7900,-74.0200 40.7900,-74.0200 40.7000)))"
      },
      {
        externalId: "NYRG_BROOKLYN_CORE",
        name: "Brooklyn Core",
        zipCodes: ["11201", "11205", "11215", "11217"],
        serviceLines: ["restoration", "hvac", "general"],
        polygon: "SRID=4326;MULTIPOLYGON(((-74.0400 40.6500,-73.9000 40.6500,-73.9000 40.7400,-74.0400 40.7400,-74.0400 40.6500)))"
      }
    ];

const DEFAULT_SEQUENCES = [
  {
    name: "Restoration Rapid Response",
    channel_mix: ["sms", "crm_task"],
    trigger_conditions: {
      service_lines: ["restoration"],
      min_job_likelihood_score: 55,
      min_urgency_score: 60
    }
  },
  {
    name: "HVAC Outage Follow-up",
    channel_mix: ["sms", "voice", "crm_task"],
    trigger_conditions: {
      service_lines: ["hvac"],
      min_job_likelihood_score: 50
    }
  }
];

const DEFAULT_SOURCES = [
  {
    source_type: "weather",
    name: "NOAA Weather Feed",
    status: "active",
    terms_status: "approved",
    provenance: "api.weather.gov",
    reliability_score: 86,
    rate_limit_policy: { requests_per_minute: 30 },
    compliance_flags: { approved: true },
    config_encrypted: {
      source_name: "NOAA Weather Feed",
      latitude: IS_SUFFOLK_PROFILE ? 40.869 : 40.7484,
      longitude: IS_SUFFOLK_PROFILE ? -72.941 : -73.9857
    }
  },
  {
    source_type: "permits",
    name: "Municipal Permits Feed",
    status: "active",
    terms_status: "approved",
    provenance: "operator.permits.provider",
    reliability_score: 74,
    rate_limit_policy: { requests_per_minute: 15 },
    compliance_flags: { approved: true },
    config_encrypted: {
      source_name: "Municipal Permits Feed",
      provider_url: process.env.PERMITS_PROVIDER_URL || "",
      provider_token: process.env.PERMITS_PROVIDER_TOKEN || ""
    }
  },
  {
    source_type: "social",
    name: "Consumer Distress Signals",
    status: "active",
    terms_status: "approved",
    provenance: "reddit+google_reviews",
    reliability_score: 61,
    rate_limit_policy: { requests_per_minute: 10 },
    compliance_flags: { approved: true },
    config_encrypted: {
      source_name: "Consumer Distress Signals",
      terms_status: "approved"
    }
  },
  {
    source_type: "incident",
    name: "Public Incident Feed",
    status: "active",
    terms_status: "approved",
    provenance: "public.incidents",
    reliability_score: 68,
    rate_limit_policy: { requests_per_minute: 20 },
    compliance_flags: { approved: true },
    config_encrypted: {
      source_name: "Public Incident Feed",
      terms_status: "approved"
    }
  },
  {
    source_type: "usgs_water",
    name: "USGS Water Signals",
    status: "active",
    terms_status: "approved",
    provenance: "api.waterdata.usgs.gov",
    reliability_score: 82,
    rate_limit_policy: { requests_per_minute: 20 },
    compliance_flags: { approved: true },
    config_encrypted: {
      source_name: "USGS Water Signals",
      site_codes: process.env.USGS_SITE_CODES || (IS_SUFFOLK_PROFILE ? "01304500,01308000" : "01358000,01371500"),
      endpoint: process.env.USGS_WATER_ENDPOINT || ""
    }
  },
  {
    source_type: "open311",
    name: "Open311 Service Requests",
    status: "active",
    terms_status: "approved",
    provenance: "open311",
    reliability_score: 69,
    rate_limit_policy: { requests_per_minute: 15 },
    compliance_flags: { approved: true },
    config_encrypted: {
      source_name: "Open311 Service Requests",
      endpoint:
        process.env.OPEN311_ENDPOINT ||
        (IS_SUFFOLK_PROFILE
          ? "https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=100&$where=borough%20in(%27QUEENS%27,%27BROOKLYN%27)%20and%20complaint_type%20in(%27WATER%20LEAK%27,%27FLOODING%27,%27SEWER%27,%27PLUMBING%27,%27FIRE%20SAFETY%20DIRECTOR%20-%20F16%27)"
          : "https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=100")
    }
  },
  {
    source_type: "openfema",
    name: "OpenFEMA Disaster Feed",
    status: "active",
    terms_status: "approved",
    provenance: "fema.gov/api/open",
    reliability_score: 78,
    rate_limit_policy: { requests_per_minute: 20 },
    compliance_flags: { approved: true },
    config_encrypted: {
      source_name: "OpenFEMA Disaster Feed",
      endpoint:
        process.env.OPENFEMA_API_URL ||
        (IS_SUFFOLK_PROFILE
          ? "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state%20eq%20%27NY%27%20and%20designatedArea%20eq%20%27Suffolk%20(County)%27&$orderby=declarationDate%20desc&$top=100"
          : "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=100&$orderby=declarationDate desc")
    }
  },
  {
    source_type: "census",
    name: "Census Enrichment Feed",
    status: "active",
    terms_status: "approved",
    provenance: "api.census.gov",
    reliability_score: 73,
    rate_limit_policy: { requests_per_minute: 10 },
    compliance_flags: { approved: true },
    config_encrypted: {
      source_name: "Census Enrichment Feed",
      endpoint:
        process.env.CENSUS_API_ENDPOINT ||
        "https://api.census.gov/data/2023/acs/acs5?get=NAME,B25034_010E,B25034_011E,B25003_003E,B25004_001E&for=county:*&in=state:36",
      state_code: process.env.CENSUS_API_STATE || "36",
      api_key: process.env.CENSUS_API_KEY || ""
    }
  },
  {
    source_type: "overpass",
    name: "OpenStreetMap Overpass Feed",
    status: "active",
    terms_status: "approved",
    provenance: "overpass-api.de",
    reliability_score: 64,
    rate_limit_policy: { requests_per_minute: 8 },
    compliance_flags: { approved: true },
    config_encrypted: {
      source_name: "OpenStreetMap Overpass Feed",
      endpoint: process.env.OVERPASS_ENDPOINT || "https://overpass-api.de/api/interpreter",
      query:
        process.env.OVERPASS_QUERY ||
        (IS_SUFFOLK_PROFILE
          ? "[out:json][timeout:25];(node[\"amenity\"~\"hospital|fire_station|school\"](40.64,-73.45,41.08,-71.79);way[\"amenity\"~\"hospital|fire_station|school\"](40.64,-73.45,41.08,-71.79););out center 30;"
          : "[out:json][timeout:25];(node[\"amenity\"~\"hospital|fire_station|school\"](40.70,-74.03,40.79,-73.93);way[\"amenity\"~\"hospital|fire_station|school\"](40.70,-74.03,40.79,-73.93););out center 30;")
    }
  }
];

async function resolveAccountId() {
  const explicit = String(process.env.OPERATOR_ACCOUNT_ID || "").trim();
  if (explicit) return explicit;

  const { data: existing, error: existingError } = await supabase
    .from("accounts")
    .select("id")
    .eq("name", OPERATOR.accountName)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return String(existing.id);

  const { data: created, error: createError } = await supabase
    .from("accounts")
    .insert({ name: OPERATOR.accountName })
    .select("id")
    .single();

  if (createError || !created?.id) throw new Error(createError?.message || "Failed to create operator account");
  return String(created.id);
}

async function upsertOperatorTenant(accountId: string) {
  const { data: byLegacy, error: byLegacyError } = await supabase
    .from("v2_tenants")
    .select("id")
    .eq("legacy_account_id", accountId)
    .maybeSingle();

  if (byLegacyError) throw new Error(byLegacyError.message);

  if (byLegacy?.id) {
    const { error } = await supabase
      .from("v2_tenants")
      .update({
        type: OPERATOR.type,
        name: OPERATOR.tenantName,
        brand: OPERATOR.brand,
        parent_tenant_id: null,
        status: "active",
        settings_json: OPERATOR.settings,
        legacy_account_id: accountId
      })
      .eq("id", byLegacy.id);

    if (error) throw new Error(error.message);
    return String(byLegacy.id);
  }

  const { data: upserted, error: upsertError } = await supabase
    .from("v2_tenants")
    .upsert(
      {
        type: OPERATOR.type,
        name: OPERATOR.tenantName,
        brand: OPERATOR.brand,
        parent_tenant_id: null,
        status: "active",
        settings_json: OPERATOR.settings,
        legacy_account_id: accountId
      },
      { onConflict: "type,name" }
    )
    .select("id")
    .single();

  if (upsertError || !upserted?.id) throw new Error(upsertError?.message || "Failed to upsert operator tenant");
  return String(upserted.id);
}

async function upsertMap(accountId: string, tenantId: string) {
  const { error } = await supabase
    .from("v2_account_tenant_map")
    .upsert(
      {
        account_id: accountId,
        enterprise_tenant_id: tenantId,
        franchise_tenant_id: tenantId
      },
      { onConflict: "account_id" }
    );

  if (error) throw new Error(error.message);
}

async function upsertTerritories(tenantId: string) {
  for (const territory of TERRITORIES) {
    const { data: existing, error: existingError } = await supabase
      .from("v2_territories")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_id", territory.externalId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    const payload = {
      tenant_id: tenantId,
      external_id: territory.externalId,
      name: territory.name,
      geometry: territory.polygon,
      zip_codes: territory.zipCodes,
      service_lines: territory.serviceLines,
      capacity_json: { max_active_assignments: 55, open_slots: 20 },
      hours_json: { timezone: "America/New_York", open: "07:00", close: "21:00" },
      active: true
    };

    let territoryId = "";

    if (existing?.id) {
      const { error } = await supabase
        .from("v2_territories")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      territoryId = String(existing.id);
    } else {
      const { data, error } = await supabase
        .from("v2_territories")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data?.id) throw new Error(error?.message || `Failed creating territory ${territory.name}`);
      territoryId = String(data.id);
    }

    const { error: versionError } = await supabase
      .from("v2_territory_versions")
      .upsert(
        {
          territory_id: territoryId,
          version_no: 1,
          geometry: territory.polygon,
          zip_codes: territory.zipCodes,
          service_lines: territory.serviceLines,
          changed_at: new Date().toISOString()
        },
        { onConflict: "territory_id,version_no" }
      );

    if (versionError) throw new Error(versionError.message);

    const { data: existingRules, error: rulesError } = await supabase
      .from("v2_routing_rules")
      .select("id,service_line")
      .eq("tenant_id", tenantId)
      .eq("territory_id", territoryId)
      .eq("active", true);

    if (rulesError) throw new Error(rulesError.message);

    const lines = ["restoration", "general"];
    for (const line of lines) {
      const rule = (existingRules || []).find((row) => row.service_line === line);
      const payloadRule = {
        tenant_id: tenantId,
        territory_id: territoryId,
        service_line: line,
        priority: line === "restoration" ? 50 : 100,
        active: true,
        rule_json: {
          kind: "service_line_default",
          sla_minutes: line === "restoration" ? 30 : 45,
          operator_mode: true
        }
      };

      if (rule?.id) {
        const { error } = await supabase
          .from("v2_routing_rules")
          .update(payloadRule)
          .eq("id", rule.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("v2_routing_rules")
          .insert(payloadRule);
        if (error) throw new Error(error.message);
      }
    }
  }
}

async function upsertSequences(tenantId: string) {
  for (const sequence of DEFAULT_SEQUENCES) {
    const { data: existing, error: existingError } = await supabase
      .from("v2_outreach_sequences")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", sequence.name)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    const payload = {
      tenant_id: tenantId,
      name: sequence.name,
      channel_mix: sequence.channel_mix,
      trigger_conditions: sequence.trigger_conditions,
      active: true
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("v2_outreach_sequences")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("v2_outreach_sequences")
        .insert(payload);
      if (error) throw new Error(error.message);
    }
  }
}

async function upsertSources(tenantId: string) {
  for (const source of DEFAULT_SOURCES) {
    const { data: existing, error: existingError } = await supabase
      .from("v2_data_sources")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", source.name)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    const payload = {
      tenant_id: tenantId,
      source_type: source.source_type,
      name: source.name,
      status: source.status,
      terms_status: source.terms_status,
      provenance: source.provenance,
      reliability_score: source.reliability_score,
      freshness_timestamp: new Date().toISOString(),
      rate_limit_policy: source.rate_limit_policy,
      compliance_flags: source.compliance_flags,
      config_encrypted: source.config_encrypted || {}
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("v2_data_sources")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("v2_data_sources")
        .insert(payload);
      if (error) throw new Error(error.message);
    }
  }
}

async function wireMembership(accountId: string, tenantId: string) {
  const explicitUser = String(process.env.OPERATOR_USER_ID || "").trim();
  let userId = explicitUser;

  if (!userId) {
    const { data, error } = await supabase
      .from("account_roles")
      .select("user_id")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.user_id) userId = String(data.user_id);
  }

  if (!userId) {
    const { data, error } = await supabase
      .from("account_roles")
      .select("user_id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.user_id) userId = String(data.user_id);
  }

  if (!userId) {
    console.warn("No active user discovered for operator membership. Set OPERATOR_USER_ID to wire memberships.");
    return;
  }

  const { data: roleExists, error: roleExistsError } = await supabase
    .from("account_roles")
    .select("id")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (roleExistsError) throw new Error(roleExistsError.message);

  if (!roleExists?.id) {
    const { error } = await supabase
      .from("account_roles")
      .insert({
        account_id: accountId,
        user_id: userId,
        role: "ACCOUNT_OWNER",
        is_active: true
      });

    if (error) throw new Error(error.message);
  }

  const { error: v2Error } = await supabase
    .from("v2_tenant_memberships")
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role: "FRANCHISE_OWNER",
        is_active: true
      },
      { onConflict: "tenant_id,user_id" }
    );

  if (v2Error) throw new Error(v2Error.message);
}

async function main() {
  const accountId = await resolveAccountId();
  const tenantId = await upsertOperatorTenant(accountId);

  await upsertMap(accountId, tenantId);
  await upsertTerritories(tenantId);
  await upsertSequences(tenantId);
  await upsertSources(tenantId);
  await wireMembership(accountId, tenantId);

  console.log("Operator seed complete.");
  console.log(`profile=${OPERATOR_PROFILE}`);
  console.log(`account_id=${accountId}`);
  console.log(`tenant_id=${tenantId}`);
  console.log("SB_USE_V2_WRITES=true");
  console.log("SB_USE_V2_READS=true");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
