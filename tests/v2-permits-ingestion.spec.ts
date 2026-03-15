import { expect, test } from "@playwright/test";
import { permitsConnector } from "../src/lib/v2/connectors/permits";
import { connectorRunnerInternals } from "../src/lib/v2/connectors/runner";
import { runConnectorForSource } from "../src/lib/v2/connectors/runner";

test("permits connector normalization includes required provenance/compliance metadata", async () => {
  const input = {
    tenantId: "tenant-1",
    sourceId: "source-1",
    sourceType: "permits",
    config: {
      source_provenance: "permits.test.provider",
      terms_status: "approved"
    }
  };

  const records = [
    {
      id: "permit-123",
      permit_type: "Roof Repair",
      occurred_at: "2026-03-14T12:00:00.000Z",
      address: "101 Main St, Albany, NY",
      severity: 70
    }
  ];

  const events = await permitsConnector.normalize(records, input);
  expect(events).toHaveLength(1);

  const normalized = events[0]?.normalizedPayload || {};
  expect(normalized.source_provenance).toBe("permits.test.provider");
  expect(normalized.terms_status).toBe("approved");
  expect(typeof normalized.data_freshness_score).toBe("number");
  expect(typeof normalized.connector_version).toBe("string");
});

test("permits compliance policy blocks ingestion when terms are not approved", () => {
  const restricted = permitsConnector.compliancePolicy({
    tenantId: "tenant-1",
    sourceId: "source-1",
    sourceType: "permits",
    config: {
      terms_status: "restricted"
    }
  });

  expect(restricted.ingestionAllowed).toBeFalsy();
  expect(restricted.requiresLegalReview).toBeTruthy();
});

test("connector runner does not process opportunities when compliance ingestion is denied", async () => {
  let pullCalled = false;

  const connector = {
    key: "test.denied",
    pull: async () => {
      pullCalled = true;
      return [];
    },
    normalize: async () => [],
    dedupeKey: () => "dedupe",
    classify: () => ({ opportunityType: "permit_signal", serviceLine: "restoration" }),
    compliancePolicy: () => ({
      termsStatus: "restricted" as const,
      ingestionAllowed: false,
      outboundAllowed: false,
      requiresLegalReview: true
    }),
    healthcheck: async () => ({ ok: true })
  };

  const touchedTables: string[] = [];

  const supabaseMock = {
    from: (table: string) => {
      touchedTables.push(table);

      if (table === "v2_connector_runs") {
        const connectorRunBuilder = {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "run-1" }, error: null })
            })
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null })
          })
        };
        return connectorRunBuilder;
      }

      throw new Error(`Unexpected table access: ${table}`);
    }
  };

  const result = await runConnectorForSource({
    supabase: supabaseMock as never,
    tenantId: "tenant-1",
    sourceId: "source-1",
    sourceType: "permits",
    sourceConfig: { terms_status: "restricted" },
    actorUserId: "user-1",
    connector
  });

  expect(result.status).toBe("failed");
  expect(result.recordsCreated).toBe(0);
  expect(pullCalled).toBeFalsy();
  expect(touchedTables).toEqual(["v2_connector_runs", "v2_connector_runs"]);
});

test("connector validation layer always provides required source_event metadata keys", () => {
  const enriched = connectorRunnerInternals.ensureSourceMetadata({
    connectorKey: "weather.noaa",
    complianceTermsStatus: "approved",
    event: {
      occurredAt: "2026-03-15T08:00:00.000Z",
      dedupeKey: "dedupe-1",
      eventType: "weather_signal",
      title: "Weather alert",
      rawPayload: {},
      normalizedPayload: {}
    }
  });

  expect(typeof enriched.source_provenance).toBe("string");
  expect(typeof enriched.connector_version).toBe("string");
  expect(typeof enriched.terms_status).toBe("string");
  expect(typeof enriched.data_freshness_score).toBe("number");
});
