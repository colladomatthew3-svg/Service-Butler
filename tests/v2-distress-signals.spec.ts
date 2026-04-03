import { expect, test } from "@playwright/test";
import { socialIntentConnector } from "../src/lib/v2/connectors/social";

test("distress connector can pull public reddit search results", async () => {
  const previousFetch = globalThis.fetch;
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input) => {
    expect(String(input)).toContain("reddit.com/search.json");

    return new Response(
      JSON.stringify({
        data: {
          children: [
            {
              data: {
                id: "reddit-live-1",
                title: "Flooded basement after last night's storm",
                selftext: "Water is still coming in near the foundation wall.",
                created_utc: 1773781200,
                author: "storm_help_needed",
                permalink: "/r/homeowners/comments/reddit_live_1/flooded_basement_after_last_nights_storm/"
              }
            }
          ]
        }
      }),
      {
        headers: {
          "content-type": "application/json"
        }
      }
    );
  };

  try {
    const records = await socialIntentConnector.pull({
      tenantId: "tenant-1",
      sourceId: "source-social-live",
      sourceType: "social",
      config: {
        terms_status: "approved",
        source_name: "Reddit",
        search_terms: ["flooded basement"],
        subreddits: ["homeowners"],
        city: "Buffalo",
        state: "NY"
      }
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.platform).toBe("reddit");
    expect(records[0]?.source_provenance).toContain("reddit.com/");
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
  }
});

test("distress connector can scrape page-based signals with Firecrawl when configured", async () => {
  const previousFetch = globalThis.fetch;
  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (_input, init) => {
    expect(String(init?.method || "POST")).toBe("POST");
    expect(String(init?.headers && (init.headers as Record<string, string>).authorization)).toBe("Bearer fc-test-key");

    const body = JSON.parse(String(init?.body || "{}")) as { url?: string; formats?: string[] };
    expect(body.url).toBe("https://example.com/forum/flood-help");
    expect(body.formats).toContain("markdown");

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          markdown: "Flooded basement after the storm. Need water extraction immediately.",
          metadata: {
            title: "Flood help needed",
            description: "Urgent basement flooding report",
            sourceURL: "https://example.com/forum/flood-help",
            publishedTime: "2026-03-16T13:00:00.000Z"
          }
        }
      }),
      {
        headers: {
          "content-type": "application/json"
        }
      }
    );
  };

  try {
    const records = await socialIntentConnector.pull({
      tenantId: "tenant-1",
      sourceId: "source-social-firecrawl",
      sourceType: "social",
      config: {
        terms_status: "approved",
        source_name: "Public Distress Signals",
        page_urls: ["https://example.com/forum/flood-help"],
        use_firecrawl: true,
        firecrawl_api_key: "fc-test-key",
        city: "Buffalo",
        state: "NY"
      }
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.title).toBe("Flood help needed");
    expect(records[0]?.source_provenance).toBe("https://example.com/forum/flood-help");
    expect(records[0]?.platform).toBe("web");
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
  }
});

test("distress connector classifies reddit flood distress into water mitigation opportunity", async () => {
  const [event] = await socialIntentConnector.normalize(
    [
      {
        id: "reddit-1",
        platform: "reddit",
        title: "Help - flooded basement after pipe burst",
        body: "Our basement is flooded and water keeps leaking from a burst pipe.",
        created_at: "2026-03-16T13:00:00.000Z",
        city: "Buffalo",
        state: "NY",
        postal_code: "14201"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-social-1",
      sourceType: "social",
      config: {
        terms_status: "approved",
        source_name: "Reddit"
      }
    }
  );

  expect(event).toBeTruthy();
  expect(event?.eventType).toBe("reddit_distress_post");
  expect(event?.serviceLineCandidates).toContain("restoration");
  expect(event?.serviceLineCandidates).toContain("plumbing");
  expect(event?.likelyJobType).toBe("water mitigation");
  expect(event?.distressContextSummary).toContain("flooded basement");

  const classification = socialIntentConnector.classify(event!);
  expect(classification.opportunityType).toBe("water_damage_distress");
  expect(classification.serviceLine).toBe("restoration");
});

test("distress connector classifies google review no-heat issues into HVAC urgency", async () => {
  const [event] = await socialIntentConnector.normalize(
    [
      {
        id: "review-1",
        platform: "google_review",
        title: "No heat in house",
        review_text: "No heat for two days and pipes may freeze",
        created_at: "2026-03-16T14:00:00.000Z",
        city: "Syracuse",
        state: "NY"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-social-2",
      sourceType: "social",
      config: {
        terms_status: "approved",
        source_name: "Google Reviews"
      }
    }
  );

  expect(event).toBeTruthy();
  expect(event?.eventType).toBe("google_review_distress");
  expect(event?.serviceLineCandidates).toContain("hvac");
  expect(event?.urgencyHint).toBeGreaterThanOrEqual(80);

  const classification = socialIntentConnector.classify(event!);
  expect(classification.opportunityType).toBe("hvac_outage_distress");
});

test("distress connector uses a public web event type for Firecrawl-backed records", async () => {
  const [event] = await socialIntentConnector.normalize(
    [
      {
        id: "web-1",
        platform: "web",
        title: "Flood damage discussion",
        body: "Flooded basement and active leak after a storm.",
        created_at: "2026-03-16T14:00:00.000Z",
        city: "Buffalo",
        state: "NY"
      }
    ],
    {
      tenantId: "tenant-1",
      sourceId: "source-social-web",
      sourceType: "social",
      config: {
        terms_status: "approved",
        source_name: "Public Distress Signals"
      }
    }
  );

  expect(event?.eventType).toBe("public_web_distress");
  expect(socialIntentConnector.classify(event!)).toEqual({
    opportunityType: "water_damage_distress",
    serviceLine: "restoration"
  });
});

test("distress connector compliance policy blocks ingestion when terms are not approved", () => {
  const policy = socialIntentConnector.compliancePolicy({
    tenantId: "tenant-1",
    sourceId: "source-social-3",
    sourceType: "social",
    config: {
      terms_status: "pending_review"
    }
  });

  expect(policy.ingestionAllowed).toBeFalsy();
  expect(policy.outboundAllowed).toBeFalsy();
  expect(policy.requiresLegalReview).toBeTruthy();
});
