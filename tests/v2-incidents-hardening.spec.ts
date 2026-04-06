import { expect, test } from "@playwright/test";
import { incidentConnector } from "../src/lib/v2/connectors/incidents";

test("incident connector avoids sample fallback when live source is configured", async () => {
  const records = await incidentConnector.pull({
    tenantId: "tenant-1",
    sourceId: "source-1",
    sourceType: "incident",
    config: {
      feed_url: "https://county.example.gov/incidents.json",
      sample_records: [{ id: "sample-1", title: "sample" }]
    }
  });

  expect(records).toEqual([]);
});

test("incident connector stale-vs-fresh filtering and timestamp confidence", async () => {
  const now = Date.now();
  const stale = new Date(now - 80 * 60 * 60 * 1000).toISOString();
  const fresh = new Date(now - 20 * 60 * 1000).toISOString();

  const events = await incidentConnector.normalize(
    [
      { id: "stale-1", title: "Old water incident", occurred_at: stale, event_type: "water incident" },
      { id: "fresh-1", title: "Fresh water incident", occurred_at: fresh, event_type: "water incident" },
      { id: "missing-ts", title: "Emergency response no timestamp", event_type: "emergency response" }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-1",
      sourceType: "incident",
      config: {
        max_event_age_hours: 48
      }
    }
  );

  expect(events.map((entry) => entry.rawPayload?.id)).toEqual(["fresh-1", "missing-ts"]);
  const freshEvent = events.find((entry) => String(entry.rawPayload?.id) === "fresh-1");
  const inferredEvent = events.find((entry) => String(entry.rawPayload?.id) === "missing-ts");
  expect((freshEvent?.normalizedPayload as Record<string, unknown>)?.timestamp_confidence).toBe("source");
  expect((inferredEvent?.normalizedPayload as Record<string, unknown>)?.timestamp_confidence).toBe("inferred");
  expect((inferredEvent?.normalizedPayload as Record<string, unknown>)?.data_freshness_score).toBe(0);
});

test("incident connector emits stable dedupe keys for duplicate records", async () => {
  const occurredAt = new Date().toISOString();
  const events = await incidentConnector.normalize(
    [
      { id: "dup-1", title: "Main break", occurred_at: occurredAt, provider: "County Feed" },
      { id: "dup-1", title: "Main break", occurred_at: occurredAt, provider: "County Feed" }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-1",
      sourceType: "incident",
      config: {}
    }
  );

  expect(events).toHaveLength(2);
  expect(events[0]?.dedupeKey).toBe(events[1]?.dedupeKey);
});

test("incident healthcheck fails safely when firecrawl scraping is configured without key", async () => {
  const health = await incidentConnector.healthcheck({
    tenantId: "tenant-1",
    sourceId: "source-1",
    sourceType: "incident",
    config: {
      use_firecrawl: true,
      page_urls: ["https://county.example.gov/incidents/flood-response"]
    }
  });

  expect(health.ok).toBeFalsy();
  expect(String(health.detail || "")).toContain("FIRECRAWL_API_KEY");
});
