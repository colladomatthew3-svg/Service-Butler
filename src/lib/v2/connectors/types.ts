export type ConnectorCompliancePolicy = {
  termsStatus: "approved" | "restricted" | "pending_review" | "blocked";
  ingestionAllowed: boolean;
  outboundAllowed: boolean;
  requiresLegalReview: boolean;
  notes?: string;
};

export type ConnectorHealth = {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
};

export type ConnectorNormalizedEvent = {
  occurredAt: string;
  dedupeKey: string;
  eventType: string;
  title: string;
  description?: string;
  locationText?: string;
  latitude?: number | null;
  longitude?: number | null;
  serviceLine?: string;
  severity?: number;
  sourceReliability?: number;
  supportingSignalsCount?: number;
  catastropheSignal?: number;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
};

export type ConnectorPullInput = {
  tenantId: string;
  sourceId: string;
  sourceType: string;
  config: Record<string, unknown>;
};

export interface ConnectorAdapter {
  readonly key: string;
  pull(input: ConnectorPullInput): Promise<Record<string, unknown>[]>;
  normalize(records: Record<string, unknown>[], input: ConnectorPullInput): Promise<ConnectorNormalizedEvent[]>;
  dedupeKey(event: ConnectorNormalizedEvent): string;
  classify(event: ConnectorNormalizedEvent): { opportunityType: string; serviceLine: string };
  compliancePolicy(input: ConnectorPullInput): ConnectorCompliancePolicy;
  healthcheck(input: ConnectorPullInput): Promise<ConnectorHealth>;
}
