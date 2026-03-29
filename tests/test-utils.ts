import fs from "node:fs";
import path from "node:path";

export const repoRoot = path.resolve(process.cwd());

export function loadLocalEnv() {
  const env = { ...process.env } as NodeJS.ProcessEnv;
  for (const file of [".env.local", ".env"]) {
    const filePath = path.join(repoRoot, file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (!(key in env)) {
        env[key] = value;
      }
    }
  }

  return env;
}
