#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ENV_FILE = path.join(ROOT, ".env.local");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    out[key] = value.replace(/^"|"$/g, "");
  }
  return out;
}

function getEnv(key, fileEnv) {
  return (process.env[key] || fileEnv[key] || "").trim();
}

function printManualFallback(reason) {
  console.log(`⚠️ Twilio auto-config skipped: ${reason}`);
  console.log("Manual fallback:");
  console.log("1) Open Twilio Console -> Phone Numbers -> Active numbers -> your number.");
  console.log("2) Set Messaging webhook to: <WEBHOOK_BASE_URL>/api/twilio/sms/inbound");
  console.log("3) Set Voice webhook to:      <WEBHOOK_BASE_URL>/api/twilio/voice/inbound");
  console.log("4) Set Status callback to:    <WEBHOOK_BASE_URL>/api/twilio/status");
}

async function twilioRequest({ method, accountSid, authToken, pathName, form }) {
  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
  const url = `${baseUrl}${pathName}`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`
  };
  const init = { method, headers };

  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(form).toString();
  }

  const res = await fetch(url, init);
  const raw = await res.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.message || raw || `HTTP ${res.status}`;
    throw new Error(`${res.status} ${msg}`.trim());
  }

  return json;
}

async function main() {
  const fileEnv = readEnvFile(ENV_FILE);
  const accountSid = getEnv("TWILIO_ACCOUNT_SID", fileEnv);
  const authToken = getEnv("TWILIO_AUTH_TOKEN", fileEnv);
  const phoneNumber = getEnv("TWILIO_PHONE_NUMBER", fileEnv);
  const webhookBaseUrl = getEnv("WEBHOOK_BASE_URL", fileEnv).replace(/\/+$/, "");

  if (!accountSid || !authToken || !phoneNumber || !webhookBaseUrl) {
    printManualFallback("missing one or more required env vars in .env.local");
    process.exit(0);
  }

  if (!webhookBaseUrl.startsWith("https://")) {
    printManualFallback("WEBHOOK_BASE_URL must be https://");
    process.exit(0);
  }

  const desiredSmsUrl = `${webhookBaseUrl}/api/twilio/sms/inbound`;
  const desiredVoiceUrl = `${webhookBaseUrl}/api/twilio/voice/inbound`;
  const desiredStatusCallback = `${webhookBaseUrl}/api/twilio/status`;

  try {
    const list = await twilioRequest({
      method: "GET",
      accountSid,
      authToken,
      pathName: `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}&PageSize=20`
    });

    const numberResource = list?.incoming_phone_numbers?.[0];
    if (!numberResource?.sid) {
      printManualFallback(`could not find Twilio incoming number resource for ${phoneNumber}`);
      process.exit(0);
    }

    const currentSmsUrl = (numberResource.sms_url || "").trim();
    const currentVoiceUrl = (numberResource.voice_url || "").trim();
    const currentStatusCallback = (numberResource.status_callback || "").trim();

    const unchanged =
      currentSmsUrl === desiredSmsUrl &&
      currentVoiceUrl === desiredVoiceUrl &&
      currentStatusCallback === desiredStatusCallback;

    if (unchanged) {
      console.log("✅ Twilio webhooks already configured.");
      console.log(`Number: ${numberResource.phone_number}`);
      console.log(`SMS:    ${desiredSmsUrl}`);
      console.log(`Voice:  ${desiredVoiceUrl}`);
      console.log(`Status: ${desiredStatusCallback}`);
      process.exit(0);
    }

    const updated = await twilioRequest({
      method: "POST",
      accountSid,
      authToken,
      pathName: `/IncomingPhoneNumbers/${numberResource.sid}.json`,
      form: {
        SmsUrl: desiredSmsUrl,
        VoiceUrl: desiredVoiceUrl,
        StatusCallback: desiredStatusCallback
      }
    });

    console.log("✅ Twilio webhooks updated.");
    console.log(`Number: ${updated.phone_number || numberResource.phone_number}`);
    console.log(`SMS:    ${updated.sms_url || desiredSmsUrl}`);
    console.log(`Voice:  ${updated.voice_url || desiredVoiceUrl}`);
    console.log(`Status: ${updated.status_callback || desiredStatusCallback}`);
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    printManualFallback(message);
    process.exit(0);
  }
}

main();
