import type { ConnectorPullInput } from "@/lib/v2/connectors/types";

export type PermitsProvider = {
  key: string;
  fetchRecords(input: ConnectorPullInput): Promise<Record<string, unknown>[]>;
  sourceProvenance(input: ConnectorPullInput): string;
  termsStatus(input: ConnectorPullInput): "approved" | "restricted" | "pending_review" | "blocked";
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function endpointFromInput(input: ConnectorPullInput) {
  return (
    String(input.config.provider_url || process.env.PERMITS_PROVIDER_URL || "").trim() ||
    ""
  );
}

function rateLimitPerMinute(input: ConnectorPullInput) {
  const policy = (input.config.rate_limit_policy || {}) as Record<string, unknown>;
  const n = Number(
    input.config.rate_limit_per_minute ||
      policy.requests_per_minute ||
      process.env.PERMITS_RATE_LIMIT_PER_MINUTE ||
      30
  );
  return Number.isFinite(n) ? Math.max(1, Math.min(600, Math.round(n))) : 30;
}

async function requestJson(url: string, input: ConnectorPullInput) {
  const token = String(input.config.provider_token || process.env.PERMITS_PROVIDER_TOKEN || "").trim();
  const headers: HeadersInit = {
    accept: "application/json",
    "user-agent": "ServiceButler-PermitsConnector/1.0"
  };
  if (token) headers.authorization = `Bearer ${token}`;

  let attempt = 0;
  const maxAttempts = 4;

  while (attempt < maxAttempts) {
    attempt += 1;
    const response = await fetch(url, {
      headers,
      cache: "no-store"
    }).catch(() => null);

    if (!response) {
      if (attempt >= maxAttempts) return [];
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
      if (attempt >= maxAttempts) return [];
      await sleep(300 * attempt);
      continue;
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const rows = Array.isArray(payload.results)
      ? (payload.results as Record<string, unknown>[])
      : Array.isArray(payload.records)
        ? (payload.records as Record<string, unknown>[])
        : Array.isArray(payload)
          ? (payload as Record<string, unknown>[])
          : [];

    return rows;
  }

  return [];
}

const remotePermitsProvider: PermitsProvider = {
  key: "permits.remote",

  async fetchRecords(input: ConnectorPullInput) {
    const endpoint = endpointFromInput(input);
    if (!endpoint) return [];

    const rpm = rateLimitPerMinute(input);
    const intervalMs = Math.round(60_000 / rpm);

    const records = await requestJson(endpoint, input);
    if (intervalMs > 0) await sleep(Math.min(intervalMs, 250));

    return records;
  },

  sourceProvenance(input: ConnectorPullInput) {
    const endpoint = endpointFromInput(input);
    return endpoint || "remote_permits_provider";
  },

  termsStatus(input: ConnectorPullInput) {
    const status = String(input.config.terms_status || process.env.PERMITS_TERMS_STATUS || "pending_review").toLowerCase();
    if (status === "approved") return "approved";
    if (status === "blocked") return "blocked";
    if (status === "restricted") return "restricted";
    return "pending_review";
  }
};

const staticPermitsProvider: PermitsProvider = {
  key: "permits.static",

  async fetchRecords(input: ConnectorPullInput) {
    const sample = input.config.sample_records;
    if (Array.isArray(sample)) {
      return sample.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
    }

    return [];
  },

  sourceProvenance(input: ConnectorPullInput) {
    return String(input.config.source_provenance || "static_permits_fixture");
  },

  termsStatus(input: ConnectorPullInput) {
    const status = String(input.config.terms_status || "restricted").toLowerCase();
    if (status === "approved") return "approved";
    if (status === "blocked") return "blocked";
    if (status === "pending_review") return "pending_review";
    return "restricted";
  }
};

export function resolvePermitsProvider(input: ConnectorPullInput): PermitsProvider {
  const endpoint = endpointFromInput(input);
  return endpoint ? remotePermitsProvider : staticPermitsProvider;
}
