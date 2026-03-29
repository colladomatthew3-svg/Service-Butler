import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { loadLocalEnv, repoRoot } from "./test-utils";

test("operator test reports simulated mode without Supabase credentials", () => {
  const result = spawnSync("node", ["scripts/operator-test.mjs"], {
    cwd: repoRoot,
    env: {
      ...loadLocalEnv(),
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: ""
    },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("mode=simulated");
  expect(result.stdout).toContain("connector run");
});

test("operator test reports live-partially-configured mode when v2 flags are off", () => {
  const result = spawnSync("node", ["scripts/operator-test.mjs"], {
    cwd: repoRoot,
    env: {
      ...loadLocalEnv(),
      SB_USE_V2_WRITES: "false",
      SB_USE_V2_READS: "false",
      SB_DISABLE_TWILIO: "true",
      SB_DISABLE_HUBSPOT: "true",
      PERMITS_PROVIDER_URL: ""
    },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });

  expect(result.stdout).toContain("mode=live-partially-configured");
  expect(result.stdout).toContain("config-note: SB_USE_V2_WRITES is not enabled");
  expect(result.stdout).toContain("config-note: SB_USE_V2_READS is not enabled");
});
