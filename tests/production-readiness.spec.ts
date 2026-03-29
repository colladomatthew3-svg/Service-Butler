import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { loadLocalEnv, repoRoot } from "./test-utils";

test("production readiness script exposes v2 and live-safe integration status", () => {
  const output = execFileSync("bash", ["scripts/production-readiness.sh"], {
    cwd: repoRoot,
    env: {
      ...loadLocalEnv(),
      SB_USE_V2_WRITES: "true",
      SB_USE_V2_READS: "true",
      SB_TWILIO_SAFE_MODE: "true",
      SB_HUBSPOT_SAFE_MODE: "true",
      SB_DISABLE_TWILIO: "true",
      SB_DISABLE_HUBSPOT: "true",
      BILLING_MODE: "disabled"
    },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  expect(output).toContain("V2 rollout flags are enabled");
  expect(output).toContain("Twilio is explicitly disabled for live-safe production");
  expect(output).toContain("HubSpot is explicitly disabled for live-safe production");
  expect(output).toContain("WEBHOOK_SHARED_SECRET is set");
});
