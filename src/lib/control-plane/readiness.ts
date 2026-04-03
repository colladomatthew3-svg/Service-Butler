import type {
  DataSourceSummary,
  DataSourceTermsStatus,
  ReadinessIssue,
  ReadinessIssueCode,
  ReadinessState
} from "@/lib/control-plane/types";

function issue(code: ReadinessIssueCode, message: string, detail?: string): ReadinessIssue {
  return { code, message, detail };
}

function uniqueActions(actions: string[]) {
  return Array.from(new Set(actions.map((value) => value.trim()).filter(Boolean)));
}

function termsBlocked(termsStatus: DataSourceTermsStatus) {
  return termsStatus === "blocked" || termsStatus === "restricted" || termsStatus === "pending_review";
}

function parseBoolean(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  const text = String(value || "").trim();
  if (!text) return [];

  return text
    .split(/[\n,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function requiresFirecrawlCredential(source: DataSourceSummary) {
  const pageUrls = parseStringList(source.config.page_urls);
  const enabled = parseBoolean(source.config.use_firecrawl);
  return pageUrls.length > 0 && enabled;
}

function usesSampleRecords(source: DataSourceSummary) {
  return Array.isArray(source.config.sample_records) && source.config.sample_records.length > 0;
}

export function buildEnvironmentReadinessState(reason: string, detail?: string): ReadinessState {
  return {
    mode: "blocked",
    live: false,
    reason,
    blockingIssues: [issue("not_live_in_environment", reason, detail)],
    recommendedActions: ["Enable live v2 reads and writes for this environment.", "Sign in with a tenant-mapped account before running buyer-proof actions."]
  };
}

export function buildDataSourceReadinessState(source: DataSourceSummary): ReadinessState {
  const blockingIssues: ReadinessIssue[] = [];
  const recommendedActions: string[] = [];

  if (!source.configured || source.status === "not_configured") {
    blockingIssues.push(
      issue("not_configured", `${source.name} is not configured yet.`, "Add the source to this tenant and save the required config before using it.")
    );
    recommendedActions.push("Add the source to the tenant control plane.");
  }

  if (termsBlocked(source.termsStatus) || termsBlocked(source.complianceStatus)) {
    blockingIssues.push(
      issue(
        "blocked_by_terms",
        `${source.name} is not approved for live ingestion.`,
        `Current terms/compliance status: ${source.termsStatus.replace(/_/g, " ")} / ${source.complianceStatus.replace(/_/g, " ")}.`
      )
    );
    recommendedActions.push("Resolve terms and compliance approval before running this source.");
  }

  if (requiresFirecrawlCredential(source) && !source.config.firecrawl_api_key && !process.env.FIRECRAWL_API_KEY) {
    blockingIssues.push(
      issue(
        "not_live_in_environment",
        `${source.name} is configured to scrape public pages, but Firecrawl credentials are missing.`,
        "Set FIRECRAWL_API_KEY or save firecrawl_api_key on this source before running health checks or live ingestion."
      )
    );
    recommendedActions.push("Set FIRECRAWL_API_KEY or add firecrawl_api_key to the source config.");
  }

  if (usesSampleRecords(source)) {
    blockingIssues.push(
      issue(
        "simulated",
        `${source.name} is using sample records.`,
        "Sample-backed sources are useful for local review, but they are excluded from live capture and buyer-proof reporting."
      )
    );
    recommendedActions.push("Remove sample_records before using this source for live capture or buyer-proof reporting.");
  }

  if (source.runtimeMode === "simulated") {
    blockingIssues.push(
      issue(
        "simulated",
        `${source.name} is still simulated.`,
        "Provide the required live configuration so buyer-facing proof does not rely on synthetic or placeholder coverage."
      )
    );
    recommendedActions.push("Complete the live configuration listed in Live requirements.");
  } else if (source.runtimeMode === "live-partial") {
    blockingIssues.push(
      issue(
        "live_partial",
        `${source.name} is only partially live.`,
        "The source is surfaced honestly, but it still has a gating issue that prevents full buyer-grade proof."
      )
    );
    recommendedActions.push("Clear the remaining live gating issue before using this source in buyer-proof flows.");
  }

  return {
    mode: blockingIssues.length > 0 ? "blocked" : "live",
    live: blockingIssues.length === 0,
    reason: blockingIssues[0]?.message || null,
    blockingIssues,
    recommendedActions: uniqueActions(recommendedActions)
  };
}

export function buyerReadinessNoteForSource(
  source: Pick<DataSourceSummary, "name" | "configured" | "status" | "runtimeMode" | "termsStatus" | "complianceStatus"> & {
    config?: Record<string, unknown>;
  }
) {
  const config = source.config || {};
  if (!source.configured || source.status === "not_configured") {
    return "Not configured in this tenant yet.";
  }
  if (Array.isArray(config.sample_records) && config.sample_records.length > 0) {
    return "Sample-backed only. Visible for operator review, but excluded from live capture and buyer-proof metrics.";
  }
  if (termsBlocked(source.termsStatus) || termsBlocked(source.complianceStatus)) {
    return `Blocked for live proof until ${source.termsStatus.replace(/_/g, " ")} terms/compliance are cleared.`;
  }
  if (source.runtimeMode === "simulated") {
    return "Visible to operators, but still simulated and excluded from buyer-proof metrics.";
  }
  if (source.runtimeMode === "live-partial") {
    return "Partially live. Keep it visible, but do not treat it as full buyer-proof coverage yet.";
  }
  return "Live-safe and eligible for buyer-proof reporting.";
}
