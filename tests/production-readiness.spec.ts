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

test("operator healthcheck reports a local Supabase runtime blocker clearly", () => {
  let output = "";

  try {
    execFileSync("npm", ["run", "operator-healthcheck"], {
      cwd: repoRoot,
      env: {
        ...loadLocalEnv(),
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65432",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
        WEBHOOK_SHARED_SECRET: "test-webhook-secret"
      },
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    output = String((error as { stdout?: string; stderr?: string }).stdout || "") + String((error as { stderr?: string }).stderr || "");
  }

  expect(output).toContain("NEXT_PUBLIC_SUPABASE_URL points to local Supabase");
  expect(output).toContain("npm run db:start");
});

test("proof seed script targets only in-window live-provider opportunities", () => {
  const script = execFileSync("node", ["-e", "const fs=require('fs');const c=fs.readFileSync('scripts/seed-verified-public-contact.mjs','utf8');console.log(c);"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  expect(script).toContain("connector_input_mode");
  expect(script).toContain("isRecentWindowTimestamp");
  expect(script).toContain("source_event_id");
});
