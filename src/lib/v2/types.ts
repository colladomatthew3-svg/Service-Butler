export type V2TenantType = "platform" | "enterprise" | "franchise";

export type V2MembershipRole =
  | "PLATFORM_ADMIN"
  | "ENTERPRISE_ADMIN"
  | "REGIONAL_MANAGER"
  | "FRANCHISE_OWNER"
  | "DISPATCHER"
  | "SDR"
  | "TECH"
  | "READ_ONLY";

export type V2RoutingStatus = "pending" | "routed" | "escalated" | "complete" | "failed";
export type V2LifecycleStatus = "new" | "qualified" | "assigned" | "contacted" | "booked_job" | "closed_lost";
export type V2AssignmentStatus = "pending_acceptance" | "accepted" | "escalated" | "complete" | "rejected";

export type V2RevenueBand = "low" | "medium" | "high" | "enterprise";

export type V2OpportunityScoreVector = {
  urgencyScore: number;
  jobLikelihoodScore: number;
  contactabilityScore: number;
  sourceReliabilityScore: number;
  revenueBand: V2RevenueBand;
  catastropheLinkageScore: number;
  confidenceScore: number;
  explainability: Record<string, unknown>;
};

export type V2TenantContext = {
  accountId: string;
  userId: string;
  role: string;
  franchiseTenantId: string;
  enterpriseTenantId: string;
  /** Franchise vertical key stored in tenant settings_json.vertical */
  franchiseVertical?: string | null;
};

export type V2AssignmentDecision = {
  assignedTenantId: string;
  backupTenantId: string | null;
  escalationTenantId: string | null;
  reason: string;
  slaMinutes: number;
};

export type V2ConnectorRunResult = {
  recordsSeen: number;
  recordsCreated: number;
  status: "completed" | "failed" | "partial";
  errorSummary?: string;
};

export type V2DashboardMetricRow = {
  label: string;
  value: number;
};
