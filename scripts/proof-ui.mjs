import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { chromium, devices } from "@playwright/test";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const branch = (await runGit(["branch", "--show-current"])).trim() || "detached-head";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const artifactDir = path.join(rootDir, "artifacts", "screenshots", sanitize(branch), timestamp);

const routes = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "dashboard", path: "/dashboard" },
  { name: "scanner", path: "/dashboard/scanner" },
  { name: "weather-settings", path: "/dashboard/settings" }
];

const viewports = [
  { name: "desktop", size: { width: 1440, height: 900 } },
  { name: "mobile", size: { width: 390, height: 844 }, device: devices["iPhone 13"] }
];

await mkdir(artifactDir, { recursive: true });

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn(
  "npm",
  ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      DEMO_MODE: process.env.DEMO_MODE || "true"
    },
    stdio: "pipe"
  }
);

const teardown = async () => {
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (!server.killed) server.kill("SIGKILL");
};

process.on("exit", () => {
  server.kill("SIGTERM");
});

server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  await waitForServer(baseUrl);
  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        ...viewport.device,
        viewport: viewport.size,
        baseURL: baseUrl
      });

      for (const route of routes) {
        const page = await context.newPage();
        try {
          await page.goto(route.path, { waitUntil: "networkidle", timeout: 30000 });
        } catch {
          try {
            await page.goto(route.path, { waitUntil: "load", timeout: 30000 });
          } catch {
            // Still capture the last rendered page state.
          }
        }

        const filename = `${viewport.name}-${route.name}.png`;
        await page.screenshot({
          path: path.join(artifactDir, filename),
          fullPage: true
        });
        await page.close();
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`UI proof saved to ${artifactDir}`);
} finally {
  await teardown();
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a port."));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "follow" });
      if (response.ok || response.status >= 300) {
        return;
      }
    } catch {
      // Wait and retry until server is up.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function sanitize(value) {
  return value.replace(/[^\w.-]+/g, "-");
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    const git = spawn("git", args, { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    git.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    git.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    git.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr || `git ${args.join(" ")} failed`));
    });
  });
}
