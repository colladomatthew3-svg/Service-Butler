import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv, repoRoot } from "./test-utils";

test.setTimeout(300000);

test("proof:servpro writes a markdown and json bundle", () => {
  const proofTimestamp = "2026-03-29T12-00-00-000Z";
  const proofDir = path.join(repoRoot, "output", "proof", proofTimestamp);

  const result = spawnSync("node", ["scripts/proof-servpro.mjs"], {
    cwd: repoRoot,
    env: {
      ...loadLocalEnv(),
      PROOF_TIMESTAMP: proofTimestamp,
      SB_USE_V2_WRITES: "true",
      SB_USE_V2_READS: "true",
      SB_TWILIO_SAFE_MODE: "true",
      SB_HUBSPOT_SAFE_MODE: "true",
      SB_DISABLE_TWILIO: "true",
      SB_DISABLE_HUBSPOT: "true"
    },
    encoding: "utf8",
    maxBuffer: 25 * 1024 * 1024,
    timeout: 240000
  });

  expect(fs.existsSync(proofDir)).toBeTruthy();
  expect(fs.existsSync(path.join(proofDir, "summary.json"))).toBeTruthy();
  expect(fs.existsSync(path.join(proofDir, "summary.md"))).toBeTruthy();

  const summary = JSON.parse(fs.readFileSync(path.join(proofDir, "summary.json"), "utf8")) as {
    proof_timestamp: string;
    status: string;
    steps: Array<{ name: string; status: string }>;
  };

  expect(summary.proof_timestamp).toBe(proofTimestamp);
  expect(summary.steps.map((step) => step.name)).toEqual([
    "operator-healthcheck",
    "validate-integrations",
    "operator-test",
    "proof-book-verified-lead",
    "qualify-real-leads"
  ]);
  expect(summary.steps).toHaveLength(5);
  expect(summary.status).toMatch(/pass|fail/);
  expect(result.stdout).toContain("Servpro proof bundle saved to");
});
