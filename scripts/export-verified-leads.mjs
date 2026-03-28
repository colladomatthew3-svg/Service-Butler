#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function asText(value) {
  return String(value || "").trim();
}

function parseObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function nowSlug() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

async function main() {
  const cwd = process.cwd();
  loadEnvFromFile(path.join(cwd, ".env.local"));
  loadEnvFromFile(path.join(cwd, ".env"));

  const supabaseUrl = asText(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = asText(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const tenantName = asText(process.env.OPERATOR_TENANT_NAME || "NY Restoration Group");
  const explicitTenantId = asText(process.env.OPERATOR_TENANT_ID);
  const limit = Math.max(1, Math.min(5000, Number(process.env.SB_VERIFIED_LEADS_EXPORT_LIMIT || 500)));

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let tenantId = explicitTenantId;
  if (!tenantId) {
    const { data: tenant, error } = await supabase
      .from("v2_tenants")
      .select("id")
      .eq("name", tenantName)
      .eq("type", "franchise")
      .limit(1)
      .maybeSingle();
    if (!error && tenant?.id) {
      tenantId = String(tenant.id);
    } else {
      const { data: fallback } = await supabase
        .from("v2_tenants")
        .select("id,name")
        .eq("type", "franchise")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!fallback?.id) {
        console.log(`Could not resolve tenant: ${tenantName}`);
        console.log("Run operator seed first (npm run operator:seed) then retry export.");
        return;
      }
      tenantId = String(fallback.id);
      console.log(`OPERATOR_TENANT_NAME not found, using fallback tenant: ${fallback.name || fallback.id}`);
    }
  }

  const { data: leads, error: leadError } = await supabase
    .from("v2_leads")
    .select("id,opportunity_id,contact_name,contact_channels_json,property_address,city,state,postal_code,lead_status,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (leadError) throw new Error(`Failed loading v2_leads: ${leadError.message}`);

  const candidateLeads = (leads || []).map((lead) => {
    const channels = parseObject(lead.contact_channels_json);
    return {
      ...lead,
      channels,
      verificationStatus: asText(channels.verification_status || ""),
      verificationScore: Number(channels.verification_score || 0),
      verificationReasons: Array.isArray(channels.verification_reasons)
        ? channels.verification_reasons.map((item) => asText(item)).filter(Boolean)
        : [],
      phone: asText(channels.phone || ""),
      email: asText(channels.email || "")
    };
  });

  const verified = candidateLeads.filter((lead) => lead.verificationStatus === "verified" && (lead.phone || lead.email));
  if (verified.length === 0) {
    console.log("No verified leads found for export.");
    return;
  }

  const opportunityIds = verified.map((lead) => asText(lead.opportunity_id)).filter(Boolean);
  const { data: opportunities } = await supabase
    .from("v2_opportunities")
    .select("id,source_event_id,title,service_line,opportunity_type,urgency_score,job_likelihood_score,created_at")
    .in("id", opportunityIds);

  const opportunityById = new Map((opportunities || []).map((row) => [asText(row.id), row]));
  const sourceEventIds = (opportunities || []).map((row) => asText(row.source_event_id)).filter(Boolean);

  const { data: sourceEvents } = sourceEventIds.length
    ? await supabase
        .from("v2_source_events")
        .select("id,source_type,source_name,source_provenance,event_category,event_timestamp")
        .in("id", sourceEventIds)
    : { data: [] };
  const sourceById = new Map((sourceEvents || []).map((row) => [asText(row.id), row]));

  const rows = verified.map((lead) => {
    const opp = opportunityById.get(asText(lead.opportunity_id)) || {};
    const source = sourceById.get(asText(opp.source_event_id)) || {};
    return {
      tenant_id: tenantId,
      lead_id: asText(lead.id),
      created_at: asText(lead.created_at),
      lead_status: asText(lead.lead_status),
      contact_name: asText(lead.contact_name),
      phone: lead.phone,
      email: lead.email,
      property_address: asText(lead.property_address),
      city: asText(lead.city),
      state: asText(lead.state),
      postal_code: asText(lead.postal_code),
      service_line: asText(opp.service_line),
      opportunity_type: asText(opp.opportunity_type),
      opportunity_title: asText(opp.title),
      urgency_score: Number(opp.urgency_score || 0),
      job_likelihood_score: Number(opp.job_likelihood_score || 0),
      source_type: asText(source.source_type),
      source_name: asText(source.source_name),
      source_provenance: asText(source.source_provenance),
      event_category: asText(source.event_category),
      event_timestamp: asText(source.event_timestamp),
      verification_status: lead.verificationStatus,
      verification_score: lead.verificationScore,
      verification_reasons: lead.verificationReasons.join(" | ")
    };
  });

  const headers = Object.keys(rows[0] || {});
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];

  const outputDir = path.join(cwd, "artifacts", "verified-leads");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `verified-leads-${nowSlug()}.csv`);
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Exported ${rows.length} verified leads`);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
