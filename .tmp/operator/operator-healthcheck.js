"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const REQUIRED_TABLES = [
    "v2_tenants",
    "v2_tenant_memberships",
    "v2_territories",
    "v2_data_sources",
    "v2_connector_runs",
    "v2_source_events",
    "v2_opportunities",
    "v2_assignments",
    "v2_leads",
    "v2_outreach_events",
    "v2_jobs",
    "v2_job_attributions"
];
function envTrue(name) {
    const value = String(process.env[name] || "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "on" || value === "yes";
}
function pushResult(list, result) {
    list.push(result);
}
async function checkTableExists(supabase, table) {
    const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
    if (error) {
        return {
            name: `table:${table}`,
            status: "FAIL",
            detail: `Table probe failed (${error.message}).`,
            remediation: "Run `npm run db:push` and verify Supabase project/migration target."
        };
    }
    return {
        name: `table:${table}`,
        status: "PASS",
        detail: "Table reachable."
    };
}
async function main() {
    const results = [];
    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const webhookSecret = String(process.env.WEBHOOK_SHARED_SECRET || "").trim();
    if (!supabaseUrl || !serviceRole) {
        pushResult(results, {
            name: "supabase_env",
            status: "FAIL",
            detail: "NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY missing.",
            remediation: "Export both variables, then re-run `npm run operator-healthcheck`."
        });
        printReport(results);
        process.exit(1);
    }
    pushResult(results, {
        name: "supabase_env",
        status: "PASS",
        detail: "Supabase URL + service role key present."
    });
    if (!webhookSecret) {
        pushResult(results, {
            name: "webhook_secret",
            status: "WARN",
            detail: "WEBHOOK_SHARED_SECRET is not set.",
            remediation: "Set WEBHOOK_SHARED_SECRET before exposing webhook endpoints publicly."
        });
    }
    else {
        pushResult(results, {
            name: "webhook_secret",
            status: "PASS",
            detail: "WEBHOOK_SHARED_SECRET configured."
        });
    }
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    const { error: connectivityError } = await supabase.from("accounts").select("id", { head: true, count: "exact" }).limit(1);
    if (connectivityError) {
        pushResult(results, {
            name: "supabase_connectivity",
            status: "FAIL",
            detail: `Supabase connectivity check failed (${connectivityError.message}).`,
            remediation: "Confirm URL/key pair and that the target project is reachable."
        });
        printReport(results);
        process.exit(1);
    }
    pushResult(results, {
        name: "supabase_connectivity",
        status: "PASS",
        detail: "Supabase connectivity OK."
    });
    for (const table of REQUIRED_TABLES) {
        pushResult(results, await checkTableExists(supabase, table));
    }
    const useWrites = envTrue("SB_USE_V2_WRITES");
    const useReads = envTrue("SB_USE_V2_READS");
    if (useWrites && useReads) {
        pushResult(results, {
            name: "feature_flags",
            status: "PASS",
            detail: "SB_USE_V2_WRITES=true and SB_USE_V2_READS=true."
        });
    }
    else {
        pushResult(results, {
            name: "feature_flags",
            status: "FAIL",
            detail: `Flags not ready (writes=${useWrites}, reads=${useReads}).`,
            remediation: "Set SB_USE_V2_WRITES=true and SB_USE_V2_READS=true for pilot activation."
        });
    }
    const operatorTenantId = String(process.env.OPERATOR_TENANT_ID || "").trim();
    const operatorTenantName = String(process.env.OPERATOR_TENANT_NAME || "NY Restoration Group").trim();
    let tenantId = operatorTenantId;
    if (!tenantId) {
        const { data, error } = await supabase
            .from("v2_tenants")
            .select("id,type,parent_tenant_id")
            .eq("name", operatorTenantName)
            .eq("type", "franchise")
            .limit(1)
            .maybeSingle();
        if (error || !data?.id) {
            pushResult(results, {
                name: "operator_tenant",
                status: "FAIL",
                detail: `Operator tenant not found (${operatorTenantName}).`,
                remediation: "Run `npm run operator:seed` or set OPERATOR_TENANT_ID explicitly."
            });
        }
        else {
            tenantId = String(data.id);
            pushResult(results, {
                name: "operator_tenant",
                status: "PASS",
                detail: `Operator tenant found (${tenantId}). parent_tenant_id=${data.parent_tenant_id || "null"}`
            });
        }
    }
    else {
        const { data, error } = await supabase
            .from("v2_tenants")
            .select("id")
            .eq("id", tenantId)
            .maybeSingle();
        if (error || !data?.id) {
            pushResult(results, {
                name: "operator_tenant",
                status: "FAIL",
                detail: `OPERATOR_TENANT_ID does not exist (${tenantId}).`,
                remediation: "Set a valid OPERATOR_TENANT_ID or run `npm run operator:seed`."
            });
        }
        else {
            pushResult(results, {
                name: "operator_tenant",
                status: "PASS",
                detail: `Operator tenant found (${tenantId}).`
            });
        }
    }
    if (tenantId) {
        const { count: territoryCount, error: territoryError } = await supabase
            .from("v2_territories")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("active", true);
        if (territoryError || !Number(territoryCount || 0)) {
            pushResult(results, {
                name: "territories",
                status: "FAIL",
                detail: territoryError?.message || "No active territories found.",
                remediation: "Seed or insert active territories for this operator tenant."
            });
        }
        else {
            pushResult(results, {
                name: "territories",
                status: "PASS",
                detail: `Active territories: ${territoryCount}.`
            });
        }
        const { count: sourceCount, error: sourceError } = await supabase
            .from("v2_data_sources")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("status", "active");
        if (sourceError || !Number(sourceCount || 0)) {
            pushResult(results, {
                name: "data_sources",
                status: "FAIL",
                detail: sourceError?.message || "No active v2_data_sources configured.",
                remediation: "Seed/update at least one active source (weather/permits/social placeholder)."
            });
        }
        else {
            pushResult(results, {
                name: "data_sources",
                status: "PASS",
                detail: `Active data sources: ${sourceCount}.`
            });
        }
    }
    const twilioDisabled = envTrue("SB_DISABLE_TWILIO");
    const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
    if (twilioConfigured) {
        pushResult(results, {
            name: "twilio",
            status: "PASS",
            detail: "Twilio credentials configured."
        });
    }
    else if (twilioDisabled) {
        pushResult(results, {
            name: "twilio",
            status: "PASS",
            detail: "Twilio explicitly disabled (SB_DISABLE_TWILIO=true)."
        });
    }
    else {
        pushResult(results, {
            name: "twilio",
            status: "FAIL",
            detail: "Twilio not configured and not explicitly disabled.",
            remediation: "Set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER or SB_DISABLE_TWILIO=true."
        });
    }
    const hubspotDisabled = envTrue("SB_DISABLE_HUBSPOT");
    const hubspotConfigured = Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
    if (hubspotConfigured) {
        pushResult(results, {
            name: "hubspot",
            status: "PASS",
            detail: "HubSpot token configured."
        });
    }
    else if (hubspotDisabled) {
        pushResult(results, {
            name: "hubspot",
            status: "PASS",
            detail: "HubSpot explicitly disabled (SB_DISABLE_HUBSPOT=true)."
        });
    }
    else {
        pushResult(results, {
            name: "hubspot",
            status: "FAIL",
            detail: "HubSpot not configured and not explicitly disabled.",
            remediation: "Set HUBSPOT_ACCESS_TOKEN or SB_DISABLE_HUBSPOT=true."
        });
    }
    const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
    const inngestConfigured = Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);
    const inngestEndpointConfigured = Boolean(appUrl);
    if (inngestConfigured && inngestEndpointConfigured) {
        pushResult(results, {
            name: "inngest",
            status: "PASS",
            detail: `Inngest keys configured with endpoint ${appUrl.replace(/\/$/, "")}/api/inngest.`
        });
    }
    else {
        pushResult(results, {
            name: "inngest",
            status: "WARN",
            detail: "Inngest config is incomplete (missing keys and/or NEXT_PUBLIC_APP_URL).",
            remediation: "Set INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, and NEXT_PUBLIC_APP_URL."
        });
    }
    const failCount = results.filter((r) => r.status === "FAIL").length;
    const warnCount = results.filter((r) => r.status === "WARN").length;
    printReport(results);
    if (failCount > 0) {
        console.error(`\nHealthcheck failed: ${failCount} failing check(s), ${warnCount} warning(s).`);
        process.exit(1);
    }
    console.log(`\nHealthcheck passed: ${results.length - warnCount} pass, ${warnCount} warning(s), 0 failures.`);
}
function printReport(results) {
    console.log("\nService Butler Operator Healthcheck\n");
    for (const result of results) {
        const prefix = result.status === "PASS" ? "[PASS]" : result.status === "WARN" ? "[WARN]" : "[FAIL]";
        console.log(`${prefix} ${result.name}: ${result.detail}`);
        if (result.remediation) {
            console.log(`       remediation: ${result.remediation}`);
        }
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
