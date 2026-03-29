import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

function loadEnvFromFile(filePath) {
  if (!existsSync(filePath)) return;
  return readFile(filePath, "utf8").then((content) => {
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  });
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadEnvFromFile(path.join(rootDir, ".env.local"));
await loadEnvFromFile(path.join(rootDir, ".env"));

if (!("SB_REQUIRE_LIVE_PROVIDER_PROOF" in process.env)) {
  process.env.SB_REQUIRE_LIVE_PROVIDER_PROOF = "true";
}

const timestamp = sanitize(process.env.PROOF_TIMESTAMP || new Date().toISOString());
const proofDir = path.join(rootDir, "output", "proof", timestamp);
await mkdir(proofDir, { recursive: true });

const steps = [
  {
    name: "operator-healthcheck",
    command: ["npm", "run", "operator-healthcheck"]
  },
  {
    name: "validate-integrations",
    command: ["npm", "run", "validate-integrations"]
  },
  {
    name: "operator-test",
    command: ["npm", "run", "operator-test"]
  },
  {
    name: "qualify-real-leads",
    command: ["node", "scripts/qualify-real-leads.mjs"]
  }
];

const results = [];

for (const step of steps) {
  const startedAt = new Date();
  const startedMs = Date.now();
  const completed = spawnSync(step.command[0], step.command.slice(1), {
    cwd: rootDir,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 25 * 1024 * 1024
  });
  const finishedAt = new Date();
  const exitCode = Number.isInteger(completed.status) ? completed.status : completed.error ? 1 : 0;
  const durationMs = Date.now() - startedMs;
  const stepDir = path.join(proofDir, step.name);
  await mkdir(stepDir, { recursive: true });

  const stdout = completed.stdout || "";
  const stderr = completed.stderr || "";
  await writeFile(path.join(stepDir, "stdout.log"), stdout, "utf8");
  await writeFile(path.join(stepDir, "stderr.log"), stderr, "utf8");

  results.push({
    name: step.name,
    command: `${step.command[0]} ${step.command.slice(1).join(" ")}`,
    status: exitCode === 0 ? "pass" : "fail",
    exit_code: exitCode,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: durationMs,
    stdout_path: path.relative(proofDir, path.join(stepDir, "stdout.log")),
    stderr_path: path.relative(proofDir, path.join(stepDir, "stderr.log")),
    stdout_excerpt: excerpt(stdout),
    stderr_excerpt: excerpt(stderr),
    signal: completed.signal || null
  });
}

const productionReadiness = await runArtifactCommand({
  name: "production-readiness",
  command: ["npm", "run", "check:production"],
  proofDir
});

const summary = {
  generated_at: new Date().toISOString(),
  proof_timestamp: timestamp,
  proof_dir: path.relative(rootDir, proofDir),
  status: results.every((step) => step.status === "pass") && productionReadiness.status === "pass" ? "pass" : "fail",
  steps: results,
  production_readiness: productionReadiness
};

await writeFile(path.join(proofDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
await writeFile(path.join(proofDir, "summary.md"), renderMarkdown(summary), "utf8");

console.log(`Servpro proof bundle saved to ${path.relative(rootDir, proofDir)}`);
for (const step of results) {
  console.log(`${step.status.toUpperCase()} ${step.name} (${step.duration_ms}ms)`);
}
console.log(`${productionReadiness.status.toUpperCase()} ${productionReadiness.name} (${productionReadiness.duration_ms}ms)`);

process.exit(summary.status === "pass" ? 0 : 1);

function sanitize(value) {
  return String(value).replace(/[:.]/g, "-").replace(/[^\w.-]+/g, "-");
}

function excerpt(text) {
  const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(0, 12).join("\n");
}

function renderMarkdown(summary) {
  const rows = summary.steps
    .map(
      (step) =>
        `| ${step.name} | ${step.status.toUpperCase()} | ${step.exit_code} | ${step.duration_ms} | \`${step.stdout_path}\` | \`${step.stderr_path}\` |`
    )
    .join("\n");

  const noteLines = summary.steps
    .map((step) => `- ${step.name}: ${step.stdout_excerpt || "no stdout"}${step.stderr_excerpt ? ` | stderr: ${step.stderr_excerpt}` : ""}`)
    .join("\n");

  return `# Servpro Proof Bundle

- Generated at: ${summary.generated_at}
- Proof timestamp: ${summary.proof_timestamp}
- Status: ${summary.status.toUpperCase()}

## Production Readiness

- Status: ${summary.production_readiness.status.toUpperCase()}
- Exit: ${summary.production_readiness.exit_code}
- Stdout: \`${summary.production_readiness.stdout_path}\`
- Stderr: \`${summary.production_readiness.stderr_path}\`

## Steps

| Step | Status | Exit | Duration (ms) | Stdout | Stderr |
| --- | --- | ---: | ---: | --- | --- |
${rows}

## Excerpts

${noteLines}
`;
}

async function runArtifactCommand({ name, command, proofDir }) {
  const startedAt = new Date();
  const startedMs = Date.now();
  const completed = spawnSync(command[0], command.slice(1), {
    cwd: rootDir,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 25 * 1024 * 1024
  });
  const finishedAt = new Date();
  const exitCode = Number.isInteger(completed.status) ? completed.status : completed.error ? 1 : 0;
  const durationMs = Date.now() - startedMs;
  const stdoutPath = `${name}.stdout.log`;
  const stderrPath = `${name}.stderr.log`;

  await writeFile(path.join(proofDir, stdoutPath), completed.stdout || "", "utf8");
  await writeFile(path.join(proofDir, stderrPath), completed.stderr || "", "utf8");

  return {
    name,
    command: `${command[0]} ${command.slice(1).join(" ")}`,
    status: exitCode === 0 ? "pass" : "fail",
    exit_code: exitCode,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: durationMs,
    stdout_path: stdoutPath,
    stderr_path: stderrPath,
    stdout_excerpt: excerpt(completed.stdout || ""),
    stderr_excerpt: excerpt(completed.stderr || ""),
    signal: completed.signal || null
  };
}
