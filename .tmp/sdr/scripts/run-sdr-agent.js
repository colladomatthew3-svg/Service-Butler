"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function loadEnvFromFile(filePath) {
    if (!node_fs_1.default.existsSync(filePath))
        return;
    const content = node_fs_1.default.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#"))
            continue;
        const separator = line.indexOf("=");
        if (separator <= 0)
            continue;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}
const cwd = process.cwd();
loadEnvFromFile(node_path_1.default.join(cwd, ".env.local"));
loadEnvFromFile(node_path_1.default.join(cwd, ".env"));
function envTrue(name) {
    const value = String(process.env[name] || "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "on" || value === "yes";
}
function toStringEnv(name, fallback = "") {
    const value = String(process.env[name] || "").trim();
    return value || fallback;
}
function toNumberEnv(name, fallback) {
    const raw = String(process.env[name] || "").trim();
    if (!raw)
        return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}
function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
function normalizePhone(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits)
        return null;
    if (digits.length === 10)
        return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1"))
        return `+${digits}`;
    if (digits.length >= 8 && digits.length <= 15)
        return `+${digits}`;
    return null;
}
function normalizeEmail(raw) {
    const email = String(raw || "").trim().toLowerCase();
    if (!email)
        return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
function extractContactCandidate(sourceEvent, title) {
    const normalized = parseObject(sourceEvent?.normalized_payload);
    const phone = normalizePhone(normalized.contact_phone ||
        normalized.owner_phone ||
        normalized.applicant_phone ||
        normalized.contractor_phone ||
        normalized.phone);
    const email = normalizeEmail(normalized.contact_email ||
        normalized.owner_email ||
        normalized.applicant_email ||
        normalized.contractor_email ||
        normalized.email);
    const name = String(normalized.contact_name ||
        normalized.owner_name ||
        normalized.applicant_name ||
        normalized.contractor_name ||
        normalized.business_name ||
        title)
        .trim()
        .replace(/\s+/g, " ");
    return {
        name: name || title,
        phone,
        email
    };
}
function verifyContactCandidate(input) {
    const reasons = [];
    let score = 0;
    const phoneValid = Boolean(input.phone) && !String(input.phone).includes("5550");
    const emailValid = Boolean(input.email) && !String(input.email).includes("@example.");
    if (phoneValid) {
        score += 48;
        reasons.push("valid phone");
    }
    else {
        reasons.push("phone missing/invalid");
    }
    if (emailValid) {
        score += 30;
        reasons.push("valid email");
    }
    else {
        reasons.push("email missing/invalid");
    }
    if (phoneValid && emailValid) {
        score += 8;
        reasons.push("multi-channel contact");
    }
    if (input.sourceReliability >= 70) {
        score += 8;
        reasons.push(`source reliability ${input.sourceReliability}`);
    }
    else if (input.sourceReliability >= 55) {
        score += 4;
    }
    const bounded = Math.max(0, Math.min(100, Math.round(score)));
    const verified = bounded >= input.minVerificationScore && (phoneValid || emailValid);
    return {
        verified,
        score: bounded,
        reasons
    };
}
function parseObject(raw) {
    if (!raw)
        return {};
    if (typeof raw === "object")
        return raw;
    if (typeof raw !== "string")
        return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
function verifyCandidate({ opportunity, sourceEvent, minJobLikelihood, minUrgency, minSourceReliability, minVerificationScore }) {
    const reasons = [];
    let score = 0;
    let blocked = false;
    const normalized = parseObject(sourceEvent?.normalized_payload);
    const compliance = String(sourceEvent?.compliance_status || normalized.compliance_status || normalized.terms_status || "pending_review");
    if (compliance !== "approved") {
        blocked = true;
        reasons.push(`blocked: compliance_status=${compliance}`);
    }
    else {
        score += 24;
        reasons.push("compliance approved");
    }
    const jobLikelihood = toNumber(opportunity.job_likelihood_score);
    const urgency = toNumber(opportunity.urgency_score);
    const reliability = toNumber(opportunity.source_reliability_score);
    const catastrophe = toNumber(opportunity.catastrophe_linkage_score);
    const freshness = toNumber(normalized.data_freshness_score, 0);
    if (jobLikelihood >= minJobLikelihood) {
        score += 22;
        reasons.push(`job_likelihood ${jobLikelihood}`);
    }
    else {
        reasons.push(`job_likelihood below threshold (${jobLikelihood})`);
    }
    if (urgency >= minUrgency) {
        score += 16;
        reasons.push(`urgency ${urgency}`);
    }
    else {
        reasons.push(`urgency below threshold (${urgency})`);
    }
    if (reliability >= minSourceReliability) {
        score += 16;
        reasons.push(`source_reliability ${reliability}`);
    }
    else {
        reasons.push(`source_reliability below threshold (${reliability})`);
    }
    if (catastrophe >= 75) {
        score += 8;
        reasons.push("catastrophe-linked");
    }
    if (freshness >= 35) {
        score += 8;
        reasons.push(`freshness ${freshness}`);
    }
    else {
        reasons.push(`freshness low (${freshness})`);
    }
    const explainability = parseObject(opportunity.explainability_json);
    const signalCount = Math.max(1, toNumber(explainability.signal_count, 1));
    if (signalCount >= 2) {
        score += 8;
        reasons.push(`multi_signal (${signalCount})`);
    }
    const hasLocation = Boolean(String(opportunity.location_text || "").trim() || String(opportunity.postal_code || "").trim());
    if (!hasLocation) {
        blocked = true;
        reasons.push("blocked: missing location");
    }
    else {
        score += 8;
        reasons.push("location available");
    }
    const qualified = !blocked && score >= minVerificationScore;
    return {
        qualified,
        score: Math.max(0, Math.min(100, score)),
        reasons
    };
}
async function resolveTenant({ supabase, explicitTenantId, tenantName }) {
    if (explicitTenantId) {
        const { data, error } = await supabase
            .from("v2_tenants")
            .select("id,legacy_account_id")
            .eq("id", explicitTenantId)
            .maybeSingle();
        const row = (data || null);
        if (error || !row?.id)
            throw new Error(`Tenant not found for OPERATOR_TENANT_ID=${explicitTenantId}`);
        return {
            tenantId: String(row.id),
            legacyAccountId: row.legacy_account_id ? String(row.legacy_account_id) : null
        };
    }
    const { data, error } = await supabase
        .from("v2_tenants")
        .select("id,legacy_account_id")
        .eq("name", tenantName)
        .eq("type", "franchise")
        .limit(1)
        .maybeSingle();
    const row = (data || null);
    if (!error && row?.id) {
        return {
            tenantId: String(row.id),
            legacyAccountId: row.legacy_account_id ? String(row.legacy_account_id) : null
        };
    }
    // Pilot fallback: use the first available franchise tenant when no explicit name/id was supplied.
    const { data: fallbackTenant, error: fallbackError } = await supabase
        .from("v2_tenants")
        .select("id,legacy_account_id,name")
        .eq("type", "franchise")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
    const fallback = (fallbackTenant || null);
    if (fallbackError || !fallback?.id) {
        throw new Error(`Could not resolve tenant by name (${tenantName}). Run 'npm run operator:seed' or set OPERATOR_TENANT_ID.`);
    }
    console.log(`[sdr-agent] OPERATOR_TENANT_NAME (${tenantName}) not found. Using fallback tenant ${fallback.name || fallback.id}.`);
    return {
        tenantId: String(fallback.id),
        legacyAccountId: fallback.legacy_account_id ? String(fallback.legacy_account_id) : null
    };
}
async function main() {
    const supabaseUrl = toStringEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = toStringEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    const dryRun = envTrue("SB_SDR_DRY_RUN");
    const maxLeads = toNumberEnv("SB_SDR_MAX_LEADS", 40);
    const maxOpportunities = toNumberEnv("SB_SDR_MAX_OPPORTUNITIES", 250);
    const minJobLikelihood = toNumberEnv("SB_SDR_MIN_JOB_LIKELIHOOD", 62);
    const minUrgency = toNumberEnv("SB_SDR_MIN_URGENCY", 58);
    const minSourceReliability = toNumberEnv("SB_SDR_MIN_SOURCE_RELIABILITY", 54);
    const minVerifyScore = toNumberEnv("SB_SDR_MIN_VERIFY_SCORE", 64);
    const dualWriteLegacy = !envTrue("SB_SDR_DISABLE_LEGACY_DUAL_WRITE");
    const tenant = await resolveTenant({
        supabase,
        explicitTenantId: toStringEnv("OPERATOR_TENANT_ID"),
        tenantName: toStringEnv("OPERATOR_TENANT_NAME", "NY Restoration Group")
    });
    const { data: opportunitiesData, error: opportunitiesError } = await supabase
        .from("v2_opportunities")
        .select("id,source_event_id,title,opportunity_type,service_line,location_text,postal_code,urgency_score,job_likelihood_score,source_reliability_score,catastrophe_linkage_score,explainability_json,created_at")
        .eq("tenant_id", tenant.tenantId)
        .in("lifecycle_status", ["new", "qualified", "assigned"])
        .order("created_at", { ascending: false })
        .limit(maxOpportunities);
    if (opportunitiesError) {
        throw new Error(`Failed loading opportunities: ${opportunitiesError.message}`);
    }
    const opportunities = (opportunitiesData || []);
    const opportunityIds = opportunities.map((row) => String(row.id));
    const sourceEventIds = opportunities
        .map((row) => String(row.source_event_id || "").trim())
        .filter(Boolean);
    const [{ data: existingLeads }, { data: sourceEvents }] = await Promise.all([
        opportunityIds.length > 0
            ? supabase
                .from("v2_leads")
                .select("id,opportunity_id,contact_channels_json")
                .eq("tenant_id", tenant.tenantId)
                .in("opportunity_id", opportunityIds)
            : Promise.resolve({ data: [] }),
        sourceEventIds.length > 0
            ? supabase.from("v2_source_events").select("id,compliance_status,normalized_payload").in("id", sourceEventIds)
            : Promise.resolve({ data: [] })
    ]);
    const existingLeadOpportunityIds = new Set((existingLeads || [])
        .map((row) => String(row.opportunity_id || "").trim())
        .filter(Boolean));
    const existingPhones = new Set();
    const existingEmails = new Set();
    for (const row of (existingLeads || [])) {
        const channels = parseObject(row.contact_channels_json);
        const phone = normalizePhone(channels.phone);
        const email = normalizeEmail(channels.email);
        if (phone)
            existingPhones.add(phone);
        if (email)
            existingEmails.add(email);
    }
    const sourceEventById = new Map();
    for (const row of (sourceEvents || [])) {
        const id = String(row.id || "").trim();
        if (id)
            sourceEventById.set(id, row);
    }
    let qualifiedCount = 0;
    let createdCount = 0;
    const created = [];
    const skipped = [];
    for (const opportunity of opportunities) {
        if (createdCount >= maxLeads)
            break;
        const opportunityId = String(opportunity.id || "").trim();
        if (!opportunityId)
            continue;
        if (existingLeadOpportunityIds.has(opportunityId)) {
            skipped.push({ opportunityId, reasons: ["existing lead already linked"] });
            continue;
        }
        const sourceEvent = sourceEventById.get(String(opportunity.source_event_id || "").trim()) || null;
        const decision = verifyCandidate({
            opportunity,
            sourceEvent,
            minJobLikelihood,
            minUrgency,
            minSourceReliability,
            minVerificationScore: minVerifyScore
        });
        if (!decision.qualified) {
            skipped.push({ opportunityId, reasons: decision.reasons });
            continue;
        }
        const serviceLine = String(opportunity.service_line || opportunity.opportunity_type || "general");
        const title = String(opportunity.title || "Service opportunity");
        const location = String(opportunity.location_text || "");
        const postalCode = String(opportunity.postal_code || "");
        const normalized = parseObject(sourceEvent?.normalized_payload);
        const city = String(normalized.city || "");
        const state = String(normalized.state || "");
        const propertyAddress = String(normalized.address_text || location || "");
        const contactCandidate = extractContactCandidate(sourceEvent, title);
        const contactDecision = verifyContactCandidate({
            phone: contactCandidate.phone,
            email: contactCandidate.email,
            sourceReliability: toNumber(opportunity.source_reliability_score, 0),
            minVerificationScore: minVerifyScore
        });
        const duplicatePhone = Boolean(contactCandidate.phone && existingPhones.has(contactCandidate.phone));
        const duplicateEmail = Boolean(contactCandidate.email && existingEmails.has(contactCandidate.email));
        const combinedScore = Math.max(0, Math.min(100, Math.round(decision.score * 0.45 + contactDecision.score * 0.55)));
        const combinedReasons = [
            ...decision.reasons,
            ...contactDecision.reasons,
            `candidate_score=${decision.score}`,
            `contact_score=${contactDecision.score}`,
            duplicatePhone ? "duplicate phone" : "",
            duplicateEmail ? "duplicate email" : ""
        ].filter(Boolean);
        if (!contactDecision.verified || duplicatePhone || duplicateEmail || combinedScore < minVerifyScore) {
            skipped.push({ opportunityId, reasons: combinedReasons });
            continue;
        }
        qualifiedCount += 1;
        if (dryRun) {
            created.push({
                opportunityId,
                leadId: "dry-run",
                score: combinedScore,
                serviceLine
            });
            createdCount += 1;
            continue;
        }
        const { data: leadRow, error: leadError } = await supabase
            .from("v2_leads")
            .insert({
            tenant_id: tenant.tenantId,
            opportunity_id: opportunityId,
            contact_name: contactCandidate.name || title,
            contact_channels_json: {
                phone: contactCandidate.phone,
                email: contactCandidate.email,
                source_type: String(opportunity.opportunity_type || "signal"),
                verification_status: "verified",
                verification_score: combinedScore,
                verification_reasons: combinedReasons
            },
            property_address: propertyAddress || null,
            city: city || null,
            state: state || null,
            postal_code: postalCode || null,
            lead_status: "new",
            crm_sync_status: "not_synced",
            do_not_contact: false
        })
            .select("id")
            .single();
        if (leadError || !leadRow?.id) {
            skipped.push({ opportunityId, reasons: [`lead_create_failed:${leadError?.message || "unknown"}`] });
            continue;
        }
        const leadId = String(leadRow.id);
        if (contactCandidate.phone)
            existingPhones.add(contactCandidate.phone);
        if (contactCandidate.email)
            existingEmails.add(contactCandidate.email);
        createdCount += 1;
        created.push({
            opportunityId,
            leadId,
            score: combinedScore,
            serviceLine
        });
        await supabase
            .from("v2_opportunities")
            .update({
            lifecycle_status: "qualified",
            contact_status: "identified",
            explainability_json: {
                ...parseObject(opportunity.explainability_json),
                sdr_verification_score: combinedScore,
                sdr_verification_reasons: combinedReasons,
                sdr_verified_at: new Date().toISOString()
            }
        })
            .eq("id", opportunityId);
        if (dualWriteLegacy && tenant.legacyAccountId) {
            await supabase.from("leads").insert({
                account_id: tenant.legacyAccountId,
                status: "new",
                stage: "NEW",
                name: contactCandidate.name || title,
                phone: contactCandidate.phone,
                service_type: serviceLine,
                address: propertyAddress || null,
                city: city || null,
                state: state || null,
                postal_code: postalCode || null,
                requested_timeframe: toNumber(opportunity.urgency_score, 0) >= 80 ? "ASAP" : "This week",
                source: "sdr_agent",
                notes: [`opportunity_id=${opportunityId}`, ...combinedReasons].join(" | ")
            });
        }
    }
    await supabase.from("v2_audit_logs").insert({
        tenant_id: tenant.tenantId,
        actor_type: "system",
        actor_id: "system:sdr-agent-cli",
        entity_type: "sdr_agent_run",
        action: "sdr_agent_cli_completed",
        after_json: {
            dry_run: dryRun,
            opportunities_scanned: opportunities.length,
            opportunities_qualified: qualifiedCount,
            leads_created: createdCount,
            max_leads: maxLeads
        }
    });
    console.log("\nService Butler SDR Agent CLI\n");
    console.log(`tenant_id=${tenant.tenantId}`);
    console.log(`dry_run=${dryRun}`);
    console.log(`opportunities_scanned=${opportunities.length}`);
    console.log(`opportunities_qualified=${qualifiedCount}`);
    console.log(`leads_created=${createdCount}`);
    if (created.length > 0) {
        console.log("\nCreated:");
        for (const row of created.slice(0, 20)) {
            console.log(`- lead_id=${row.leadId} opportunity_id=${row.opportunityId} score=${row.score} service_line=${row.serviceLine}`);
        }
    }
    if (skipped.length > 0) {
        console.log("\nSkipped:");
        for (const row of skipped.slice(0, 20)) {
            console.log(`- opportunity_id=${row.opportunityId} reasons=${row.reasons.join("; ")}`);
        }
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
