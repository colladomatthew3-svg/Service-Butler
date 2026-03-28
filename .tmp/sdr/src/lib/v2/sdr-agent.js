"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdrAgentInternals = void 0;
exports.runSdrAgentV2 = runSdrAgentV2;
const enrichment_1 = require("@/lib/services/enrichment");
const audit_1 = require("@/lib/v2/audit");
const registry_1 = require("@/lib/v2/connectors/registry");
const runner_1 = require("@/lib/v2/connectors/runner");
const source_type_map_1 = require("@/lib/v2/connectors/source-type-map");
const lead_verification_1 = require("@/lib/v2/lead-verification");
const outreach_orchestrator_1 = require("@/lib/v2/outreach-orchestrator");
const routing_engine_1 = require("@/lib/v2/routing-engine");
function parseObject(raw) {
    if (!raw)
        return {};
    if (typeof raw === "object")
        return raw;
    if (typeof raw !== "string")
        return {};
    const trimmed = raw.trim();
    if (!trimmed)
        return {};
    try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
function toString(value) {
    return String(value || "").trim();
}
function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
function normalizedAddressKey(input) {
    const address = toString(input.address).toLowerCase().replace(/\s+/g, " ");
    const city = toString(input.city).toLowerCase();
    const state = toString(input.state).toLowerCase();
    const postalCode = toString(input.postalCode);
    return [address, city, state, postalCode].filter(Boolean).join("|");
}
function parseCityStatePostal(text) {
    const raw = String(text || "");
    const zipMatch = raw.match(/\b\d{5}\b/);
    const postalCode = zipMatch?.[0] || "";
    const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
    const city = parts.length >= 2 ? parts[parts.length - 2] || "" : "";
    const stateToken = parts.length >= 1 ? parts[parts.length - 1] || "" : "";
    const state = stateToken.replace(/\d{5}/g, "").trim().split(/\s+/)[0] || "";
    return { city, state, postalCode };
}
function stageFromLeadStatus(status) {
    const normalized = status.toLowerCase();
    if (normalized === "new")
        return "NEW";
    if (normalized === "contacted")
        return "CONTACTED";
    if (normalized === "scheduled")
        return "BOOKED";
    if (normalized === "won")
        return "COMPLETED";
    if (normalized === "lost")
        return "LOST";
    return "NEW";
}
function buildSdrSmsMessage(input) {
    const location = [input.city, input.state].filter(Boolean).join(", ");
    return `Hi, this is Service Butler. We saw a likely ${input.serviceLine || "home-service"} need${location ? ` near ${location}` : ""} (${input.title}). If you'd like help today, reply YES and we can get you scheduled quickly.`;
}
function choosePrimarySourceType(explainability, fallback) {
    if (Array.isArray(explainability.source_types) && explainability.source_types.length > 0) {
        return String(explainability.source_types[0] || fallback);
    }
    if (typeof explainability.source_type === "string" && explainability.source_type.trim()) {
        return explainability.source_type.trim();
    }
    return fallback;
}
function verifyCandidate({ opportunity, sourceEvent, minJobLikelihood, minUrgency, minSourceReliability }) {
    const reasons = [];
    let score = 0;
    let blocked = false;
    const normalizedSource = (sourceEvent?.normalized_payload || {}) || {};
    const complianceStatus = toString(sourceEvent?.compliance_status || normalizedSource.compliance_status || normalizedSource.terms_status || "pending_review");
    if (complianceStatus !== "approved") {
        blocked = true;
        reasons.push(`blocked: compliance_status=${complianceStatus}`);
    }
    else {
        score += 24;
        reasons.push("compliance approved");
    }
    const jobLikelihood = toNumber(opportunity.job_likelihood_score, 0);
    const urgency = toNumber(opportunity.urgency_score, 0);
    const reliability = toNumber(opportunity.source_reliability_score, 0);
    const catastrophe = toNumber(opportunity.catastrophe_linkage_score, 0);
    if (jobLikelihood >= minJobLikelihood) {
        score += 22;
        reasons.push(`job_likelihood ${jobLikelihood} >= ${minJobLikelihood}`);
    }
    else {
        score += Math.max(0, Math.round((jobLikelihood / Math.max(minJobLikelihood, 1)) * 14));
        reasons.push(`job_likelihood below threshold (${jobLikelihood})`);
    }
    if (urgency >= minUrgency) {
        score += 16;
        reasons.push(`urgency ${urgency} >= ${minUrgency}`);
    }
    else {
        reasons.push(`urgency below threshold (${urgency})`);
    }
    if (reliability >= minSourceReliability) {
        score += 16;
        reasons.push(`source reliability ${reliability} >= ${minSourceReliability}`);
    }
    else {
        reasons.push(`source reliability below threshold (${reliability})`);
    }
    if (catastrophe >= 75) {
        score += 8;
        reasons.push("catastrophe-linked signal");
    }
    const explainability = (opportunity.explainability_json || {});
    const signalCount = Math.max(1, toNumber(explainability.signal_count, 1));
    const confidenceScore = toNumber(explainability.confidence_score, 0);
    if (signalCount >= 2) {
        score += 9;
        reasons.push(`multi-signal (${signalCount})`);
    }
    else if (confidenceScore >= 75) {
        score += 6;
        reasons.push(`high confidence single-signal (${confidenceScore})`);
    }
    const locationText = toString(opportunity.location_text);
    const postalCode = toString(opportunity.postal_code || normalizedSource.postal_code);
    const hasAddress = Boolean(locationText || postalCode);
    if (hasAddress) {
        score += 8;
        reasons.push("location available");
    }
    else {
        blocked = true;
        reasons.push("blocked: missing location");
    }
    const freshness = toNumber(normalizedSource.data_freshness_score, 0);
    if (freshness >= 35) {
        score += 7;
        reasons.push(`freshness ${freshness}`);
    }
    else {
        reasons.push(`stale freshness ${freshness}`);
    }
    const qualified = !blocked;
    return {
        qualified,
        score: Math.max(0, Math.min(100, score)),
        reasons
    };
}
async function resolveTenantLegacyAccountId({ supabase, tenantId }) {
    const { data } = await supabase
        .from("v2_tenants")
        .select("legacy_account_id")
        .eq("id", tenantId)
        .maybeSingle();
    const legacy = toString(data?.legacy_account_id);
    return legacy || null;
}
async function findActiveSources({ supabase, tenantId, sourceIds, maxSources }) {
    let query = supabase
        .from("v2_data_sources")
        .select("id,source_type,name,config_encrypted,rate_limit_policy,compliance_flags,terms_status,provenance,status")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .limit(maxSources);
    if (sourceIds && sourceIds.length > 0)
        query = query.in("id", sourceIds);
    const { data } = await query;
    return (data || []);
}
async function runSourceConnectors({ supabase, tenantId, actorUserId, sources }) {
    const results = [];
    for (const source of sources) {
        const sourceType = toString(source.source_type || "unknown");
        const baseConfig = parseObject(source.config_encrypted);
        const sourceConfig = {
            connector_name: source.name,
            rate_limit_policy: source.rate_limit_policy,
            compliance_flags: source.compliance_flags,
            terms_status: source.terms_status,
            source_provenance: source.provenance,
            ...baseConfig
        };
        const connectorKey = (0, source_type_map_1.inferConnectorKey)(sourceType);
        const connector = (0, registry_1.getConnectorByKey)(connectorKey);
        if (!connector) {
            results.push({
                sourceId: String(source.id),
                sourceType,
                connectorKey,
                status: "failed",
                recordsSeen: 0,
                recordsCreated: 0,
                error: `connector_not_found:${connectorKey}`
            });
            continue;
        }
        const health = await connector.healthcheck({
            tenantId,
            sourceId: String(source.id),
            sourceType,
            config: sourceConfig
        });
        if (!health.ok) {
            results.push({
                sourceId: String(source.id),
                sourceType,
                connectorKey,
                status: "skipped",
                recordsSeen: 0,
                recordsCreated: 0,
                error: health.detail || "healthcheck_failed"
            });
            continue;
        }
        const run = await (0, runner_1.runConnectorForSource)({
            supabase,
            tenantId,
            sourceId: String(source.id),
            sourceType,
            sourceConfig,
            actorUserId,
            connector
        });
        results.push({
            sourceId: String(source.id),
            sourceType,
            connectorKey,
            status: run.status,
            recordsSeen: run.recordsSeen,
            recordsCreated: run.recordsCreated,
            error: run.errorSummary
        });
    }
    return results;
}
exports.sdrAgentInternals = {
    verifyCandidate,
    buildSdrSmsMessage,
    parseCityStatePostal,
    extractLeadContactCandidate: lead_verification_1.extractLeadContactCandidate,
    verifyLeadContactCandidate: lead_verification_1.verifyLeadContactCandidate
};
async function runSdrAgentV2(options) {
    const { supabase, tenantId, actorUserId, sourceIds, maxSources = 20, maxOpportunities = 250, maxLeadsToCreate = 40, minJobLikelihood = 62, minUrgency = 58, minSourceReliability = 54, minVerificationScore = 64, runConnectors = true, autoRoute = true, autoOutreach = false, enableEnrichment = true, dryRun = false, dualWriteLegacy = true } = options;
    const enterpriseTenantId = toString(options.enterpriseTenantId) || tenantId;
    const connectorRuns = [];
    const skipped = [];
    const created = [];
    if (runConnectors) {
        const sources = await findActiveSources({
            supabase,
            tenantId,
            sourceIds,
            maxSources
        });
        const sourceRuns = await runSourceConnectors({
            supabase,
            tenantId,
            actorUserId,
            sources
        });
        connectorRuns.push(...sourceRuns);
    }
    const { data: opportunitiesData } = await supabase
        .from("v2_opportunities")
        .select("id,source_event_id,title,description,opportunity_type,service_line,location_text,postal_code,urgency_score,job_likelihood_score,source_reliability_score,catastrophe_linkage_score,routing_status,lifecycle_status,explainability_json,created_at")
        .eq("tenant_id", tenantId)
        .in("lifecycle_status", ["new", "qualified", "assigned"])
        .order("created_at", { ascending: false })
        .limit(maxOpportunities);
    const opportunities = (opportunitiesData || []);
    if (opportunities.length === 0) {
        return {
            tenantId,
            dryRun,
            connectorRuns,
            opportunitiesScanned: 0,
            opportunitiesQualified: 0,
            leadsCreated: 0,
            routedCount: 0,
            outreachSentCount: 0,
            skipped,
            created
        };
    }
    const opportunityIds = opportunities.map((row) => String(row.id));
    const sourceEventIds = opportunities
        .map((row) => toString(row.source_event_id))
        .filter(Boolean);
    const [{ data: existingLeads }, { data: sourceEvents }, { data: assignments }] = await Promise.all([
        supabase
            .from("v2_leads")
            .select("id,opportunity_id,contact_channels_json,property_address,city,state,postal_code")
            .eq("tenant_id", tenantId)
            .in("opportunity_id", opportunityIds),
        sourceEventIds.length > 0
            ? supabase
                .from("v2_source_events")
                .select("id,compliance_status,normalized_payload")
                .in("id", sourceEventIds)
            : Promise.resolve({ data: [] }),
        supabase
            .from("v2_assignments")
            .select("id,opportunity_id,status")
            .eq("tenant_id", tenantId)
            .in("opportunity_id", opportunityIds)
    ]);
    const leadByOpportunity = new Map();
    const existingPhones = new Set();
    const existingEmails = new Set();
    const existingAddresses = new Set();
    for (const row of (existingLeads || [])) {
        const oppId = toString(row.opportunity_id);
        const leadId = toString(row.id);
        if (oppId && leadId)
            leadByOpportunity.set(oppId, leadId);
        const channels = parseObject(row.contact_channels_json);
        const normalizedPhone = (0, lead_verification_1.normalizePhone)(channels.phone);
        const normalizedEmail = (0, lead_verification_1.normalizeEmail)(channels.email);
        const addressKey = normalizedAddressKey({
            address: toString(row.property_address),
            city: toString(row.city),
            state: toString(row.state),
            postalCode: toString(row.postal_code)
        });
        if (normalizedPhone)
            existingPhones.add(normalizedPhone);
        if (normalizedEmail)
            existingEmails.add(normalizedEmail);
        if (addressKey)
            existingAddresses.add(addressKey);
    }
    const sourceEventById = new Map();
    for (const row of (sourceEvents || [])) {
        const id = toString(row.id);
        if (id)
            sourceEventById.set(id, row);
    }
    const assignmentByOpportunity = new Map();
    for (const row of (assignments || [])) {
        const oppId = toString(row.opportunity_id);
        if (!oppId)
            continue;
        if (!assignmentByOpportunity.has(oppId))
            assignmentByOpportunity.set(oppId, row);
    }
    const legacyAccountId = options.legacyAccountId ?? (dualWriteLegacy ? await resolveTenantLegacyAccountId({ supabase, tenantId }) : null);
    let routedCount = 0;
    let outreachSentCount = 0;
    let opportunitiesQualified = 0;
    for (const opportunity of opportunities) {
        if (created.length >= maxLeadsToCreate)
            break;
        const opportunityId = toString(opportunity.id);
        if (!opportunityId)
            continue;
        if (leadByOpportunity.has(opportunityId))
            continue;
        const sourceEvent = sourceEventById.get(toString(opportunity.source_event_id)) || null;
        const decision = verifyCandidate({
            opportunity,
            sourceEvent,
            minJobLikelihood,
            minUrgency,
            minSourceReliability
        });
        if (!decision.qualified) {
            skipped.push({ opportunityId, reasons: decision.reasons });
            continue;
        }
        const normalizedSource = (sourceEvent?.normalized_payload || {}) || {};
        const explainability = (opportunity.explainability_json || {}) || {};
        const postalCode = toString(opportunity.postal_code || normalizedSource.postal_code);
        const cityState = parseCityStatePostal(toString(opportunity.location_text));
        const city = toString(normalizedSource.city || cityState.city);
        const state = toString(normalizedSource.state || cityState.state);
        const serviceLine = toString(opportunity.service_line || explainability.primary_service_line || opportunity.opportunity_type || "general");
        const title = toString(opportunity.title || "Service opportunity");
        const propertyAddress = toString(normalizedSource.address_text || opportunity.location_text || "");
        const sourceType = choosePrimarySourceType(explainability, toString(opportunity.opportunity_type || "signal"));
        let enrichmentContact = null;
        const leadNotes = [];
        if (enableEnrichment && propertyAddress) {
            const enrichment = await (0, enrichment_1.enrichOpportunityLive)({
                address: propertyAddress,
                city,
                state,
                postalCode: postalCode || cityState.postalCode,
                serviceType: serviceLine || "general"
            }).catch(() => null);
            if (enrichment?.ownerContact) {
                enrichmentContact = {
                    name: toString(enrichment.ownerContact.name) || null,
                    phone: toString(enrichment.ownerContact.phone) || null,
                    email: toString(enrichment.ownerContact.email) || null
                };
            }
            if (Array.isArray(enrichment?.notes)) {
                leadNotes.push(...enrichment.notes.map((note) => String(note)));
            }
        }
        const extractedContact = (0, lead_verification_1.extractLeadContactCandidate)({
            sourceEvent,
            opportunity,
            enrichmentContact
        });
        const addressKey = normalizedAddressKey({
            address: propertyAddress,
            city,
            state,
            postalCode: postalCode || cityState.postalCode || null
        });
        const multiSignal = toNumber(explainability.signal_count, 1) >= 2;
        const contactVerification = (0, lead_verification_1.verifyLeadContactCandidate)(extractedContact, {
            sourceReliability: toNumber(opportunity.source_reliability_score, 0),
            freshnessScore: toNumber(normalizedSource.data_freshness_score, 0),
            hasMultiSignal: multiSignal,
            duplicatePhone: Boolean(extractedContact.phone && existingPhones.has(extractedContact.phone)),
            duplicateEmail: Boolean(extractedContact.email && existingEmails.has(extractedContact.email)),
            duplicateAddress: Boolean(addressKey && existingAddresses.has(addressKey))
        });
        const combinedVerificationScore = Math.max(0, Math.min(100, Math.round(decision.score * 0.45 + contactVerification.score * 0.55)));
        const combinedReasons = [
            ...decision.reasons,
            ...contactVerification.reasons,
            `candidate_score=${decision.score}`,
            `contact_score=${contactVerification.score}`
        ];
        if (contactVerification.status === "rejected" || combinedVerificationScore < minVerificationScore) {
            skipped.push({ opportunityId, reasons: combinedReasons });
            continue;
        }
        opportunitiesQualified += 1;
        const ownerPhone = contactVerification.phone;
        const ownerEmail = contactVerification.email;
        const ownerName = contactVerification.name;
        const leadStatus = contactVerification.status === "verified" ? "new" : "research_required";
        const doNotContact = contactVerification.status !== "verified";
        const leadPayload = {
            tenant_id: tenantId,
            opportunity_id: opportunityId,
            contact_name: ownerName || null,
            business_name: null,
            contact_channels_json: {
                phone: ownerPhone,
                email: ownerEmail,
                source_type: sourceType,
                verification_status: contactVerification.status,
                verification_score: combinedVerificationScore,
                verification_reasons: combinedReasons,
                contact_provenance: contactVerification.provenance,
                contact_evidence: contactVerification.evidence
            },
            property_address: propertyAddress || null,
            city: city || null,
            state: state || null,
            postal_code: postalCode || cityState.postalCode || null,
            lead_status: leadStatus,
            crm_sync_status: "not_synced",
            do_not_contact: doNotContact
        };
        if (dryRun) {
            created.push({
                opportunityId,
                leadId: "dry-run",
                verificationScore: combinedVerificationScore,
                verificationReasons: combinedReasons,
                verificationStatus: contactVerification.status,
                routed: false,
                outreachSent: false,
                sourceType,
                serviceLine
            });
            continue;
        }
        const { data: leadRow, error: leadError } = await supabase
            .from("v2_leads")
            .insert(leadPayload)
            .select("id")
            .single();
        if (leadError || !leadRow?.id) {
            skipped.push({ opportunityId, reasons: [`lead_create_failed:${leadError?.message || "unknown"}`] });
            continue;
        }
        const leadId = String(leadRow.id);
        leadByOpportunity.set(opportunityId, leadId);
        if (ownerPhone)
            existingPhones.add(ownerPhone);
        if (ownerEmail)
            existingEmails.add(ownerEmail);
        if (addressKey)
            existingAddresses.add(addressKey);
        await supabase
            .from("v2_opportunities")
            .update({
            lifecycle_status: "qualified",
            contact_status: contactVerification.status === "verified" ? "identified" : "unknown",
            explainability_json: {
                ...explainability,
                sdr_verification_score: combinedVerificationScore,
                sdr_verification_reasons: combinedReasons,
                sdr_contact_verification_status: contactVerification.status,
                sdr_contact_provenance: contactVerification.provenance,
                sdr_contact_evidence: contactVerification.evidence,
                sdr_verified_at: new Date().toISOString(),
                sdr_notes: leadNotes
            }
        })
            .eq("id", opportunityId);
        if (dualWriteLegacy && legacyAccountId) {
            await supabase.from("leads").insert({
                account_id: legacyAccountId,
                status: "new",
                stage: stageFromLeadStatus("new"),
                name: ownerName || title,
                phone: ownerPhone,
                service_type: serviceLine || "General",
                address: propertyAddress || null,
                city: city || null,
                state: state || null,
                postal_code: postalCode || cityState.postalCode || null,
                requested_timeframe: toNumber(opportunity.urgency_score, 0) >= 80 ? "ASAP" : "This week",
                source: "sdr_agent",
                notes: [
                    `opportunity_id=${opportunityId}`,
                    ...combinedReasons,
                    ...leadNotes
                ].join(" | ")
            });
        }
        let routed = false;
        let assignmentId = null;
        if (autoRoute) {
            const existingAssignment = assignmentByOpportunity.get(opportunityId);
            if (!existingAssignment) {
                const routeResult = await (0, routing_engine_1.routeOpportunityV2)({
                    supabase,
                    tenantId,
                    enterpriseTenantId,
                    opportunityId,
                    actorUserId
                }).catch(() => null);
                if (routeResult?.assignment?.id) {
                    routed = true;
                    routedCount += 1;
                    assignmentId = String(routeResult.assignment.id);
                }
            }
            else {
                assignmentId = toString(existingAssignment.id) || null;
            }
        }
        let outreachSent = false;
        if (autoOutreach && ownerPhone && contactVerification.status === "verified") {
            const outreach = await (0, outreach_orchestrator_1.dispatchOutreach)({
                supabase,
                tenantId,
                leadId,
                assignmentId,
                actorUserId,
                channel: "sms",
                to: ownerPhone,
                body: buildSdrSmsMessage({
                    serviceLine,
                    title,
                    city,
                    state
                })
            }).catch(() => null);
            if (outreach?.sent) {
                outreachSent = true;
                outreachSentCount += 1;
            }
        }
        created.push({
            opportunityId,
            leadId,
            verificationScore: combinedVerificationScore,
            verificationReasons: combinedReasons,
            verificationStatus: contactVerification.status,
            routed,
            outreachSent,
            sourceType,
            serviceLine
        });
    }
    await (0, audit_1.logV2AuditEvent)({
        tenantId,
        actorType: "system",
        actorId: actorUserId,
        entityType: "sdr_agent_run",
        entityId: null,
        action: "sdr_agent_completed",
        before: null,
        after: {
            opportunities_scanned: opportunities.length,
            opportunities_qualified: opportunitiesQualified,
            leads_created: created.length,
            routed_count: routedCount,
            outreach_sent_count: outreachSentCount,
            run_connectors: runConnectors,
            auto_route: autoRoute,
            auto_outreach: autoOutreach,
            dry_run: dryRun
        }
    });
    return {
        tenantId,
        dryRun,
        connectorRuns,
        opportunitiesScanned: opportunities.length,
        opportunitiesQualified,
        leadsCreated: created.length,
        routedCount,
        outreachSentCount,
        skipped,
        created
    };
}
