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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function asText(value) {
  return String(value ?? "").trim();
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

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sourceKeyFromRow(row) {
  const parts = [row.source_id, row.source_type, row.source_name, row.source_provenance].map((value) => asText(value)).filter(Boolean);
  return parts.join(" | ") || "unknown-source";
}

function sourceCategoryFromSignal(sourceType) {
  const normalized = String(sourceType || "").toLowerCase();
  if (normalized.includes("weather") || normalized.includes("storm") || normalized.includes("hail") || normalized.includes("wind") || normalized.includes("freeze") || normalized.includes("flood")) return "weather_damage";
  if (normalized.includes("permit")) return "building_permits";
  if (normalized.includes("incident") || normalized.includes("fire") || normalized.includes("emergency") || normalized.includes("infrastructure")) return "public_incident";
  if (normalized.includes("reddit") || normalized.includes("google") || normalized.includes("distress") || normalized.includes("social")) return "consumer_distress";
  return "other";
}

function isVerifiedLead(leadRow) {
  const channels = parseObject(leadRow.contact_channels_json);
  const status = asText(channels.verification_status || leadRow.lead_status || "");
  const score = toNumber(channels.verification_score || 0);
  const phone = asText(channels.phone || "");
  const email = asText(channels.email || "");
  return status === "verified" && score >= 70 && Boolean(phone || email);
}

function whyWorkThisLead(row) {
  const parts = [];
  if (row.phone) parts.push(`reachable by phone ${row.phone}`);
  if (row.email) parts.push(`email ${row.email}`);
  if (row.source_name || row.source_type) parts.push(`source ${[row.source_name, row.source_type].filter(Boolean).join(" - ")}`);
  if (row.service_line || row.opportunity_type) parts.push(`service line ${row.service_line || row.opportunity_type}`);
  if (Array.isArray(row.verification_reasons) && row.verification_reasons.length > 0) {
    parts.push(`reasons ${row.verification_reasons.slice(0, 3).join(", ")}`);
  }
  return parts.join("; ");
}

function sourceTrustSummary(sourceRanking) {
  return sourceRanking.reduce(
    (acc, row) => {
      const recommendation = String(row.recommendation || "pause");
      if (recommendation === "keep") acc.keep += 1;
      else if (recommendation === "tune") acc.tune += 1;
      else acc.pause += 1;
      return acc;
    },
    { keep: 0, tune: 0, pause: 0 }
  );
}

function formatPct(n) {
  return `${Math.round(n * 100) / 100}%`;
}

function writeReportArtifacts({
  cwd,
  filenameSlug,
  markdown,
  json
}) {
  const outputDir = path.join(cwd, "artifacts", "suffolk-quality");
  fs.mkdirSync(outputDir, { recursive: true });

  const markdownPath = path.join(outputDir, `suffolk-quality-report-${filenameSlug}.md`);
  const jsonPath = path.join(outputDir, `suffolk-quality-report-${filenameSlug}.json`);

  fs.writeFileSync(markdownPath, `${markdown}\n`, "utf8");
  fs.writeFileSync(jsonPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");

  return { markdownPath, jsonPath };
}

function buildTemplateReport(reason) {
  const templateSources = [
    { source_name: "NOAA Weather Feed", source_type: "weather", recommendation: "keep", note: "Primary storm/freeze lead source" },
    { source_name: "Municipal Permits Feed", source_type: "permits", recommendation: "keep", note: "High-value service-line signal" },
    { source_name: "Public Incident Feed", source_type: "incident", recommendation: "tune", note: "Useful, but watch noise" },
    { source_name: "Consumer Distress Signals", source_type: "social", recommendation: "tune", note: "Requires careful QA" },
    { source_name: "USGS Water Signals", source_type: "usgs_water", recommendation: "keep", note: "Strong flood/water proxy" },
    { source_name: "Open311 Service Requests", source_type: "open311", recommendation: "tune", note: "Great for municipal service issues" },
    { source_name: "OpenFEMA Disaster Feed", source_type: "openfema", recommendation: "keep", note: "Catastrophe-aware signal" },
    { source_name: "Census Enrichment Feed", source_type: "census", recommendation: "pause", note: "Enrichment only, not a lead source" },
    { source_name: "OpenStreetMap Overpass Feed", source_type: "overpass", recommendation: "tune", note: "Property and facility context" }
  ];

  const generatedAt = new Date().toISOString();
  const summary = {
    tenant_id: null,
    tenant_name: "Suffolk Restoration Group",
    generated_at: generatedAt,
    mode: "template",
    reason,
    source_count: templateSources.length,
    source_trust_summary: sourceTrustSummary(templateSources),
    opportunity_count: 0,
    lead_count: 0,
    verified_lead_count: 0,
    booked_job_count: 0,
    total_revenue: 0
  };

  const markdown = [
    `# Suffolk Lead Quality Report`,
    ``,
    `Mode: template`,
    `Generated: ${generatedAt}`,
    ``,
    `> ${reason}`,
    ``,
    `## Summary`,
    ``,
    `- Source events: 0`,
    `- Opportunities: 0`,
    `- Leads: 0`,
    `- Verified leads: 0`,
    `- Booked jobs: 0`,
    `- Estimated revenue: $0`,
    `- Source trust: ${summary.source_trust_summary.keep} keep / ${summary.source_trust_summary.tune} tune / ${summary.source_trust_summary.pause} pause`,
    ``,
    `## Source Ranking Scaffold`,
    ``,
    `| Rank | Source | Category | Score | Recommendation | Notes |`,
    `| --- | --- | --- | ---: | --- | --- |`,
    ...templateSources.map((row, index) => `| ${index + 1} | ${row.source_name} | ${row.source_type} | tbd | ${row.recommendation} | ${row.note} |`),
    ``,
    `## Verified Lead Evidence Pack Scaffold`,
    ``,
    `| Lead | Contact | Source | Service Line | Verification Score | Booked Jobs | Outreach | Why Work It |`,
    `| --- | --- | --- | --- | ---: | ---: | ---: | --- |`,
    `| tbd | tbd | tbd | tbd | tbd | tbd | tbd | tbd |`,
    ``,
    `## Next Step`,
    ``,
    `Seed the Suffolk tenant, then rerun this report without template mode to populate live ranking and evidence rows.`
  ].join("\n");

  const { markdownPath, jsonPath } = writeReportArtifacts({
    cwd: process.cwd(),
    filenameSlug: nowSlug(),
    markdown,
    json: { summary, sourceRanking: templateSources, verifiedLeads: [] }
  });

  console.log(`Generated Suffolk lead quality report scaffold`);
  console.log(markdownPath);
  console.log(jsonPath);
  console.log(`Note: ${reason}`);
}

async function resolveTenant(supabase) {
  const explicitTenantId = asText(process.env.OPERATOR_TENANT_ID);
  const tenantName = asText(process.env.OPERATOR_TENANT_NAME || "Suffolk Restoration Group");

  if (explicitTenantId) {
    const { data, error } = await supabase
      .from("v2_tenants")
      .select("id,name,type")
      .eq("id", explicitTenantId)
      .eq("type", "franchise")
      .maybeSingle();

    if (error || !data?.id) {
      throw new Error(`Could not resolve tenant id ${explicitTenantId}`);
    }

    return { tenantId: String(data.id), tenantName: String(data.name || tenantName) };
  }

  const { data, error } = await supabase
    .from("v2_tenants")
    .select("id,name,type")
    .eq("name", tenantName)
    .eq("type", "franchise")
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(`Could not resolve tenant ${tenantName}. Run operator seed first.`);
  }

  return { tenantId: String(data.id), tenantName: String(data.name || tenantName) };
}

async function main() {
  const templateMode = process.argv.includes("--template") || envTrue("SB_SUFFOLK_REPORT_TEMPLATE");
  const cwd = process.cwd();
  loadEnvFromFile(path.join(cwd, ".env.local"));
  loadEnvFromFile(path.join(cwd, ".env"));

  const supabaseUrl = asText(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = asText(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let tenant;
  try {
    tenant = await resolveTenant(supabase);
  } catch (error) {
    if (templateMode) {
      buildTemplateReport(error instanceof Error ? error.message : "Tenant not found");
      return;
    }
    throw error;
  }

  const { tenantId, tenantName } = tenant;

  const [
    { data: sourceEvents, error: sourceError },
    { data: opportunities, error: opportunityError },
    { data: leads, error: leadError },
    { data: jobs, error: jobError },
    { data: outreachEvents, error: outreachError }
  ] = await Promise.all([
    supabase
      .from("v2_source_events")
      .select(
        "id,source_id,source_type,source_name,source_provenance,compliance_status,data_freshness_score,source_reliability_score,connector_version,event_category,service_line_candidates,severity_hint,urgency_hint,event_timestamp,ingested_at"
      )
      .eq("tenant_id", tenantId)
      .order("ingested_at", { ascending: false })
      .limit(1000),
    supabase
      .from("v2_opportunities")
      .select(
        "id,source_event_id,opportunity_type,service_line,title,urgency_score,job_likelihood_score,source_reliability_score,catastrophe_linkage_score,routing_status,lifecycle_status,created_at,explainability_json"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("v2_leads")
      .select("id,opportunity_id,lead_status,contact_name,contact_channels_json,created_at,owner_user_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("v2_jobs")
      .select("id,lead_id,status,revenue_amount,booked_at,scheduled_at")
      .eq("tenant_id", tenantId)
      .order("booked_at", { ascending: false })
      .limit(1000),
    supabase
      .from("v2_outreach_events")
      .select("id,lead_id,channel,event_type,outcome,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(2000)
  ]);

  if (sourceError) throw new Error(`Failed loading source events: ${sourceError.message}`);
  if (opportunityError) throw new Error(`Failed loading opportunities: ${opportunityError.message}`);
  if (leadError) throw new Error(`Failed loading leads: ${leadError.message}`);
  if (jobError) throw new Error(`Failed loading jobs: ${jobError.message}`);
  if (outreachError) throw new Error(`Failed loading outreach events: ${outreachError.message}`);

  const sourceRows = sourceEvents || [];
  const opportunityRows = opportunities || [];
  const leadRows = leads || [];
  const jobRows = jobs || [];
  const outreachRows = outreachEvents || [];

  const leadsByOpportunity = new Map();
  for (const lead of leadRows) {
    const key = asText(lead.opportunity_id);
    if (!key) continue;
    if (!leadsByOpportunity.has(key)) leadsByOpportunity.set(key, []);
    leadsByOpportunity.get(key).push(lead);
  }

  const jobsByLead = new Map();
  for (const job of jobRows) {
    const key = asText(job.lead_id);
    if (!key) continue;
    if (!jobsByLead.has(key)) jobsByLead.set(key, []);
    jobsByLead.get(key).push(job);
  }

  const outreachByLead = new Map();
  for (const outreach of outreachRows) {
    const key = asText(outreach.lead_id);
    if (!key) continue;
    if (!outreachByLead.has(key)) outreachByLead.set(key, []);
    outreachByLead.get(key).push(outreach);
  }

  const opportunitiesBySourceEvent = new Map();
  for (const opportunity of opportunityRows) {
    const key = asText(opportunity.source_event_id);
    if (!key) continue;
    if (!opportunitiesBySourceEvent.has(key)) opportunitiesBySourceEvent.set(key, []);
    opportunitiesBySourceEvent.get(key).push(opportunity);
  }

  const sourceStats = new Map();

  for (const source of sourceRows) {
    const key = sourceKeyFromRow(source);
    if (!sourceStats.has(key)) {
      sourceStats.set(key, {
        key,
        source_id: asText(source.source_id),
        source_type: asText(source.source_type),
        source_name: asText(source.source_name),
        source_provenance: asText(source.source_provenance),
        event_category: asText(source.event_category),
        source_category: sourceCategoryFromSignal(source.source_type),
        compliance_statuses: new Set(),
        approved_event_count: 0,
        freshness_scores: [],
        reliability_scores: [],
        urgency_hints: [],
        severity_hints: [],
        event_count: 0,
        opportunity_count: 0,
        lead_count: 0,
        verified_lead_count: 0,
        booked_job_count: 0,
        revenue: 0,
        outreach_count: 0,
        review_count: 0,
        reject_count: 0
      });
    }

    const stats = sourceStats.get(key);
    stats.event_count += 1;
    const compliance = asText(source.compliance_status || "unknown");
    stats.compliance_statuses.add(compliance);
    if (compliance === "approved") stats.approved_event_count += 1;
    stats.freshness_scores.push(toNumber(source.data_freshness_score, 0));
    stats.reliability_scores.push(toNumber(source.source_reliability_score, 0));
    stats.urgency_hints.push(toNumber(source.urgency_hint, 0));
    stats.severity_hints.push(toNumber(source.severity_hint, 0));

    const opps = opportunitiesBySourceEvent.get(asText(source.id)) || [];
    stats.opportunity_count += opps.length;

    for (const opp of opps) {
      const oppLeads = leadsByOpportunity.get(asText(opp.id)) || [];
      stats.lead_count += oppLeads.length;

      for (const lead of oppLeads) {
        const verified = isVerifiedLead(lead);
        if (verified) stats.verified_lead_count += 1;
        else {
          const status = asText(lead.lead_status);
          if (status === "review") stats.review_count += 1;
          if (status === "rejected") stats.reject_count += 1;
        }

        const leadJobs = jobsByLead.get(asText(lead.id)) || [];
        const bookedJobs = leadJobs.filter((job) => String(job.status || "").toLowerCase().includes("book"));
        stats.booked_job_count += bookedJobs.length;
        stats.revenue += bookedJobs.reduce((sum, job) => sum + toNumber(job.revenue_amount, 0), 0);

        const leadOutreach = outreachByLead.get(asText(lead.id)) || [];
        stats.outreach_count += leadOutreach.length;
      }
    }
  }

  const sourceRanking = Array.from(sourceStats.values()).map((stats) => {
    const approvedRate = stats.event_count > 0 ? stats.approved_event_count / stats.event_count : 0;
    const freshness = average(stats.freshness_scores);
    const reliability = average(stats.reliability_scores);
    const verifiedLeadRate = stats.opportunity_count > 0 ? stats.verified_lead_count / stats.opportunity_count : 0;
    const bookedJobRate = stats.lead_count > 0 ? stats.booked_job_count / stats.lead_count : 0;
    const falsePositiveRate = stats.opportunity_count > 0 ? Math.max(0, (stats.opportunity_count - stats.verified_lead_count) / stats.opportunity_count) : 1;

    const score = clampScore(
      approvedRate * 20 +
      freshness * 0.2 +
      reliability * 0.25 +
      verifiedLeadRate * 30 +
      bookedJobRate * 25 -
      falsePositiveRate * 18
    );

    const recommendation = score >= 75 ? "keep" : score >= 50 ? "tune" : "pause";

    return {
      ...stats,
      compliance_approved_rate: approvedRate,
      avg_freshness_score: freshness,
      avg_reliability_score: reliability,
      verified_lead_rate: verifiedLeadRate,
      booked_job_rate: bookedJobRate,
      false_positive_rate: falsePositiveRate,
      score,
      recommendation
    };
  }).sort((a, b) => b.score - a.score);
  const sourceTrust = sourceTrustSummary(sourceRanking);

  const verifiedLeads = leadRows.filter(isVerifiedLead).slice(0, 20).map((lead) => {
    const channels = parseObject(lead.contact_channels_json);
    const opp = opportunityRows.find((item) => asText(item.id) === asText(lead.opportunity_id)) || {};
    const sourceEvent = sourceRows.find((item) => asText(item.id) === asText(opp.source_event_id)) || {};
    const leadJobs = jobsByLead.get(asText(lead.id)) || [];
    const leadOutreach = outreachByLead.get(asText(lead.id)) || [];

    return {
      lead_id: asText(lead.id),
      contact_name: asText(lead.contact_name),
      phone: asText(channels.phone || ""),
      email: asText(channels.email || ""),
      verification_status: asText(channels.verification_status || lead.lead_status || ""),
      verification_score: toNumber(channels.verification_score || 0),
      verification_reasons: Array.isArray(channels.verification_reasons) ? channels.verification_reasons.map((value) => asText(value)).filter(Boolean) : [],
      source_name: asText(sourceEvent.source_name || ""),
      source_type: asText(sourceEvent.source_type || ""),
      source_provenance: asText(sourceEvent.source_provenance || ""),
      source_category: sourceCategoryFromSignal(sourceEvent.source_type),
      opportunity_title: asText(opp.title || ""),
      opportunity_type: asText(opp.opportunity_type || ""),
      service_line: asText(opp.service_line || ""),
      routing_status: asText(opp.routing_status || ""),
      lead_status: asText(lead.lead_status || ""),
      booked_jobs: leadJobs.length,
      outreach_events: leadOutreach.length,
      proof_summary: whyWorkThisLead({
        phone: asText(channels.phone || ""),
        email: asText(channels.email || ""),
        source_name: asText(sourceEvent.source_name || ""),
        source_type: asText(sourceEvent.source_type || ""),
        service_line: asText(opp.service_line || ""),
        opportunity_type: asText(opp.opportunity_type || ""),
        verification_reasons: Array.isArray(channels.verification_reasons)
          ? channels.verification_reasons.map((value) => asText(value)).filter(Boolean)
          : []
      })
    };
  });

  const generatedAt = new Date().toISOString();
  const summary = {
    tenant_id: tenantId,
    tenant_name: tenantName,
    generated_at: generatedAt,
    source_count: sourceRows.length,
    source_trust_summary: sourceTrust,
    opportunity_count: opportunityRows.length,
    lead_count: leadRows.length,
    verified_lead_count: leadRows.filter(isVerifiedLead).length,
    booked_job_count: jobRows.filter((job) => String(job.status || "").toLowerCase().includes("book")).length,
    total_revenue: jobRows.reduce((sum, job) => sum + toNumber(job.revenue_amount, 0), 0)
  };

  const outputDir = path.join(cwd, "artifacts", "suffolk-quality");
  fs.mkdirSync(outputDir, { recursive: true });
  const slug = nowSlug();

  const markdown = [
    `# Suffolk Lead Quality Report`,
    ``,
    `Tenant: ${summary.tenant_name}`,
    `Generated: ${summary.generated_at}`,
    ``,
    `## Summary`,
    ``,
    `- Source events: ${summary.source_count}`,
    `- Opportunities: ${summary.opportunity_count}`,
    `- Leads: ${summary.lead_count}`,
    `- Verified leads: ${summary.verified_lead_count}`,
    `- Booked jobs: ${summary.booked_job_count}`,
    `- Estimated revenue: $${summary.total_revenue.toLocaleString()}`,
    `- Source trust: ${summary.source_trust_summary.keep} keep / ${summary.source_trust_summary.tune} tune / ${summary.source_trust_summary.pause} pause`,
    ``,
    `## Source Ranking`,
    ``,
    `| Rank | Source | Category | Score | Recommendation | Events | Opportunities | Verified Leads | Booked Jobs | Freshness | Reliability | False Positive |`,
    `| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
    ...sourceRanking.slice(0, 20).map((row, index) => {
      return `| ${index + 1} | ${row.source_name || row.source_type || row.key} | ${row.source_category} | ${row.score} | ${row.recommendation} | ${row.event_count} | ${row.opportunity_count} | ${row.verified_lead_count} | ${row.booked_job_count} | ${Math.round(row.avg_freshness_score)} | ${Math.round(row.avg_reliability_score)} | ${formatPct(row.false_positive_rate)} |`;
    }),
    ``,
    `## Verified Lead Evidence Pack`,
    ``,
    `| Lead | Contact | Source | Service Line | Verification Score | Booked Jobs | Outreach | Why Work It |`,
    `| --- | --- | --- | --- | ---: | ---: | ---: | --- |`,
    ...verifiedLeads.map((row) => {
      const contact = [row.phone, row.email].filter(Boolean).join(" / ") || "n/a";
      const source = [row.source_name, row.source_type].filter(Boolean).join(" - ");
      return `| ${row.contact_name || row.lead_id} | ${contact} | ${source || "n/a"} | ${row.service_line || row.opportunity_type || "n/a"} | ${row.verification_score} | ${row.booked_jobs} | ${row.outreach_events} | ${row.proof_summary || "n/a"} |`;
    }),
    ``,
    `## Weekly QA Notes`,
    ``,
    '- Treat sources with `keep` as active Suffolk sources.',
    '- Treat sources with `tune` as active but noisy; review false-positive reasons before scaling.',
    '- Treat sources with `pause` as blocked until QA improves.',
    `- Use the verified lead evidence pack to review contactability and attribution before the weekly customer call.`
  ].join("\n");

  const { markdownPath, jsonPath } = writeReportArtifacts({
    cwd,
    filenameSlug: slug,
    markdown,
    json: { summary, sourceRanking, verifiedLeads }
  });

  console.log(`Generated Suffolk lead quality report for ${tenantName}`);
  console.log(markdownPath);
  console.log(jsonPath);
  console.log(`Sources ranked: ${sourceRanking.length}`);
  console.log(`Verified leads in evidence pack: ${verifiedLeads.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
