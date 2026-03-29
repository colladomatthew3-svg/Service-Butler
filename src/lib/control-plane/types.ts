export type DataSourceRuntimeMode = "fully-live" | "live-partial" | "simulated";

export type DataSourceTermsStatus = "approved" | "restricted" | "pending_review" | "blocked" | "unknown";

export type DataSourceStatus = "active" | "paused" | "disabled" | "not_configured";

export type ReadinessMode = "live" | "demo" | "blocked";

export type ReadinessIssueCode =
  | "not_configured"
  | "simulated"
  | "live_partial"
  | "blocked_by_terms"
  | "not_live_in_environment";

export type ReadinessIssue = {
  code: ReadinessIssueCode;
  message: string;
  detail?: string;
};

export type ReadinessState = {
  mode: ReadinessMode;
  live: boolean;
  reason: string | null;
  blockingIssues: ReadinessIssue[];
  recommendedActions: string[];
};

export type ConnectorHealthSummary = {
  ok: boolean;
  detail: string;
  checkedAt: string;
  latencyMs?: number;
  runtimeMode: DataSourceRuntimeMode;
  complianceStatus: DataSourceTermsStatus;
};

export type DataSourceSummary = {
  id: string | null;
  catalogKey: string;
  connectorKey: string;
  family: string;
  sourceType: string;
  name: string;
  description: string;
  configured: boolean;
  status: DataSourceStatus;
  runtimeMode: DataSourceRuntimeMode;
  termsStatus: DataSourceTermsStatus;
  complianceStatus: DataSourceTermsStatus;
  freshness: number;
  freshnessTimestamp: string | null;
  freshnessLabel: string;
  reliability: number;
  latestRunStatus: string | null;
  latestRunCompletedAt: string | null;
  latestEventAt: string | null;
  recordsSeen: number;
  recordsCreated: number;
  provenance: string | null;
  liveRequirements: string[];
  buyerReadinessNote: string;
  config: Record<string, unknown>;
  configTemplate: Record<string, unknown>;
  rateLimitPolicy: Record<string, unknown>;
};

export type DataSourceMutationPayload = {
  catalogKey?: string;
  name?: string;
  status?: Exclude<DataSourceStatus, "not_configured">;
  termsStatus?: Exclude<DataSourceTermsStatus, "unknown">;
  reliabilityScore?: number;
  provenance?: string;
  config?: Record<string, unknown>;
  rateLimitPolicy?: Record<string, unknown>;
};

export type IntegrationReadinessCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  required: boolean;
  message: string;
};

export type IntegrationReadinessSummary = {
  status: "pass" | "warn" | "fail";
  checkedAt: string;
  checks: IntegrationReadinessCheck[];
};
