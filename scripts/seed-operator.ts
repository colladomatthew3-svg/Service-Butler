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

const OPERATOR = {
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

const TERRITORIES = [
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
    compliance_flags: { approved: true }
  },
  {
    source_type: "permits",
    name: "Municipal Permits Feed",
    status: "active",
    terms_status: "approved",
    provenance: "operator.permits.provider",
    reliability_score: 74,
    rate_limit_policy: { requests_per_minute: 15 },
    compliance_flags: { approved: true }
  },
  {
    source_type: "social",
    name: "Social Intent Placeholder",
    status: "active",
    terms_status: "pending_review",
    provenance: "placeholder.social",
    reliability_score: 45,
    rate_limit_policy: { requests_per_minute: 10 },
    compliance_flags: { approved: false }
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
      compliance_flags: source.compliance_flags
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
  console.log(`account_id=${accountId}`);
  console.log(`tenant_id=${tenantId}`);
  console.log("SB_USE_V2_WRITES=true");
  console.log("SB_USE_V2_READS=true");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
