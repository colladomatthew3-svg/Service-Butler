"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePermitsProvider = resolvePermitsProvider;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function endpointFromInput(input) {
    return (String(input.config.provider_url || process.env.PERMITS_PROVIDER_URL || "").trim() ||
        "");
}
function rateLimitPerMinute(input) {
    const policy = (input.config.rate_limit_policy || {});
    const n = Number(input.config.rate_limit_per_minute ||
        policy.requests_per_minute ||
        process.env.PERMITS_RATE_LIMIT_PER_MINUTE ||
        30);
    return Number.isFinite(n) ? Math.max(1, Math.min(600, Math.round(n))) : 30;
}
async function requestJson(url, input) {
    const token = String(input.config.provider_token || process.env.PERMITS_PROVIDER_TOKEN || "").trim();
    const headers = {
        accept: "application/json",
        "user-agent": "ServiceButler-PermitsConnector/1.0"
    };
    if (token)
        headers.authorization = `Bearer ${token}`;
    let attempt = 0;
    const maxAttempts = 4;
    while (attempt < maxAttempts) {
        attempt += 1;
        const response = await fetch(url, {
            headers,
            cache: "no-store"
        }).catch(() => null);
        if (!response) {
            if (attempt >= maxAttempts)
                return [];
            await sleep(400 * attempt);
            continue;
        }
        if (response.status === 429) {
            const retryAfter = Number(response.headers.get("retry-after") || 0);
            const waitMs = retryAfter > 0 ? retryAfter * 1000 : 500 * attempt;
            await sleep(waitMs);
            continue;
        }
        if (!response.ok) {
            if (attempt >= maxAttempts)
                return [];
            await sleep(300 * attempt);
            continue;
        }
        const payload = (await response.json().catch(() => ({})));
        const rows = Array.isArray(payload.results)
            ? payload.results
            : Array.isArray(payload.records)
                ? payload.records
                : Array.isArray(payload)
                    ? payload
                    : [];
        return rows;
    }
    return [];
}
const remotePermitsProvider = {
    key: "permits.remote",
    async fetchRecords(input) {
        const endpoint = endpointFromInput(input);
        if (!endpoint)
            return [];
        const rpm = rateLimitPerMinute(input);
        const intervalMs = Math.round(60_000 / rpm);
        const records = await requestJson(endpoint, input);
        if (intervalMs > 0)
            await sleep(Math.min(intervalMs, 250));
        return records;
    },
    sourceProvenance(input) {
        const endpoint = endpointFromInput(input);
        return endpoint || "remote_permits_provider";
    },
    termsStatus(input) {
        const status = String(input.config.terms_status || process.env.PERMITS_TERMS_STATUS || "pending_review").toLowerCase();
        if (status === "approved")
            return "approved";
        if (status === "blocked")
            return "blocked";
        if (status === "restricted")
            return "restricted";
        return "pending_review";
    }
};
const staticPermitsProvider = {
    key: "permits.static",
    async fetchRecords(input) {
        const sample = input.config.sample_records;
        if (Array.isArray(sample)) {
            return sample.filter((row) => Boolean(row && typeof row === "object"));
        }
        return [];
    },
    sourceProvenance(input) {
        return String(input.config.source_provenance || "static_permits_fixture");
    },
    termsStatus(input) {
        const status = String(input.config.terms_status || "restricted").toLowerCase();
        if (status === "approved")
            return "approved";
        if (status === "blocked")
            return "blocked";
        if (status === "pending_review")
            return "pending_review";
        return "restricted";
    }
};
function resolvePermitsProvider(input) {
    const endpoint = endpointFromInput(input);
    return endpoint ? remotePermitsProvider : staticPermitsProvider;
}
