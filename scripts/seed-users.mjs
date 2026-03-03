#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const cwd = process.cwd();
loadEnvFromFile(path.join(cwd, ".env.local"));
loadEnvFromFile(path.join(cwd, ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; cannot seed auth users.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const seedUsers = [
  { email: "owner@servicebutler.local", password: "Password123!" },
  { email: "dispatcher@servicebutler.local", password: "Password123!" },
  { email: "tech@servicebutler.local", password: "Password123!" }
];

const existingEmails = new Set();
let page = 1;
let done = false;

while (!done) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("Failed to list users:", error.message);
    process.exit(1);
  }

  for (const u of data.users || []) {
    if (u.email) existingEmails.add(u.email.toLowerCase());
  }

  done = !data.users || data.users.length < 200;
  page += 1;
}

for (const user of seedUsers) {
  if (existingEmails.has(user.email.toLowerCase())) {
    console.log(`User exists: ${user.email}`);
    continue;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true
  });

  if (error) {
    console.error(`Failed creating ${user.email}:`, error.message);
    process.exit(1);
  }

  console.log(`Created user: ${user.email}`);
}
