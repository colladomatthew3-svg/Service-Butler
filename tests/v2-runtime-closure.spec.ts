import { expect, test } from "@playwright/test";
import { runConnectorForSource } from "../src/lib/v2/connectors/runner";
import { buildConnectorRunIdempotencyKey } from "../src/lib/v2/connector-run-request";
import { markStaleConnectorRuns, resolveStaleAfterMinutes } from "../src/lib/v2/runtime-watchdog";

test("duplicate trigger suppression returns existing run without coercing status", async () => {
  const supabaseMock = {
    from(table: string) {
      if (table !== "v2_connector_runs") throw new Error(`Unexpected table ${table}`);
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } })
          })
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: "run-existing-1",
                        status: "running",
                        records_seen: 9,
                        records_created: 4,
                        error_summary: "",
                        idempotency_key: "dup-key",
                        replayed_from_run_id: null,
                        metadata: { run_mode: "standard" }
                      },
                      error: null
                    })
                  })
                })
              })
            })
          })
        })
      };
    }
  };

  const result = await runConnectorForSource({
    supabase: supabaseMock as never,
    tenantId: "tenant-1",
    sourceId: "source-1",
    sourceType: "incident",
    sourceConfig: {},
    actorUserId: "user-1",
    connector: {
      key: "incident",
      pull: async () => [],
      normalize: async () => [],
      classify: () => ({ opportunityType: "incident", serviceLine: "restoration" }),
      dedupeKey: () => "dedupe",
      compliancePolicy: () => ({ termsStatus: "approved", ingestionAllowed: true, outboundAllowed: false, requiresLegalReview: false }),
      healthcheck: async () => ({ ok: true })
    },
    idempotencyKey: "dup-key"
  });

  expect(result.runId).toBe("run-existing-1");
  expect(result.status).toBe("running");
  expect(result.recordsSeen).toBe(9);
  expect(result.recordsCreated).toBe(4);
});

test("replay run preserves lineage and marks terminal status replayed", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  const connectorRuns: Array<Record<string, unknown>> = [];
  const runUpdates: Array<Record<string, unknown>> = [];

  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input, init) => {
    const url = String(input);
    if (!url.includes("/rest/v1/v2_audit_logs")) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(JSON.stringify([{ id: "audit-1", payload: init?.body ? JSON.parse(String(init.body)) : {} }]), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  };

  const supabaseMock = {
    from(table: string) {
      if (table === "v2_connector_runs") {
        return {
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const row = { id: "run-replay-1", ...payload };
                connectorRuns.push(row);
                return { data: row, error: null };
              }
            })
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              runUpdates.push(patch);
              return { data: null, error: null };
            }
          })
        };
      }

      if (table === "v2_tenants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { settings_json: { vertical: "restoration" } }, error: null })
            })
          })
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }
  };

  try {
    const result = await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-1",
      sourceType: "incident",
      sourceConfig: {},
      actorUserId: "user-1",
      connector: {
        key: "incident",
        pull: async () => [],
        normalize: async () => [],
        classify: () => ({ opportunityType: "incident", serviceLine: "restoration" }),
        dedupeKey: () => "dedupe",
        compliancePolicy: () => ({ termsStatus: "approved", ingestionAllowed: true, outboundAllowed: false, requiresLegalReview: false }),
        healthcheck: async () => ({ ok: true })
      },
      runMode: "replay",
      replayedFromRunId: "run-original-1",
      idempotencyKey: "replay-key-1"
    });

    expect(result.status).toBe("replayed");
    expect(result.replayedFromRunId).toBe("run-original-1");
    expect(result.idempotencyKey).toBe("replay-key-1");
    expect(connectorRuns[0]?.replayed_from_run_id).toBe("run-original-1");
    expect(connectorRuns[0]?.idempotency_key).toBe("replay-key-1");
    expect((runUpdates[runUpdates.length - 1]?.metadata as Record<string, unknown>)?.replayed_from_run_id).toBe("run-original-1");
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});

test("stale-run marking uses bounded threshold behavior", async () => {
  expect(resolveStaleAfterMinutes(undefined, 45)).toBe(45);
  expect(resolveStaleAfterMinutes(2, 45)).toBe(5);
  expect(resolveStaleAfterMinutes(17.6, 45)).toBe(18);

  const calls: Array<Record<string, unknown>> = [];
  const supabaseMock = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, ...args });
      return { data: 3, error: null };
    }
  };

  const marked = await markStaleConnectorRuns({
    supabase: supabaseMock as never,
    staleAfterMinutes: 3
  });

  expect(marked).toBe(3);
  expect(calls[0]?.name).toBe("mark_stale_connector_runs");
  expect(calls[0]?.p_stale_after_minutes).toBe(5);
});

test("legacy-compatible standard run remains completed and idempotency keys are stable", async () => {
  const previousFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = async (input) => {
    const url = String(input);
    if (!url.includes("/rest/v1/v2_audit_logs")) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(JSON.stringify([{ id: "audit-compat-1" }]), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  };

  const supabaseMock = {
    from(table: string) {
      if (table === "v2_connector_runs") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "run-standard-1" }, error: null })
            })
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null })
          })
        };
      }
      if (table === "v2_tenants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { settings_json: {} }, error: null })
            })
          })
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }
  };

  const key = buildConnectorRunIdempotencyKey({
    entrypoint: "legacy_compat_check",
    tenantId: "tenant-1",
    sourceId: "source-1",
    connectorKey: "incident",
    providedKey: "legacy-fixed-key"
  });
  expect(key).toBe("legacy-fixed-key");

  try {
    const result = await runConnectorForSource({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      sourceId: "source-1",
      sourceType: "incident",
      sourceConfig: {},
      actorUserId: "user-1",
      connector: {
        key: "incident",
        pull: async () => [],
        normalize: async () => [],
        classify: () => ({ opportunityType: "incident", serviceLine: "restoration" }),
        dedupeKey: () => "dedupe",
        compliancePolicy: () => ({ termsStatus: "approved", ingestionAllowed: true, outboundAllowed: false, requiresLegalReview: false }),
        healthcheck: async () => ({ ok: true })
      },
      idempotencyKey: key
    });

    expect(result.status).toBe("completed");
    expect(result.runMode).toBe("standard");
  } finally {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = previousFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});
