import { expect, test } from "@playwright/test";
import { sendTwilioMessage } from "../src/lib/v2/twilio";
import { createHubSpotTask } from "../src/lib/v2/hubspot";

test("twilio safe mode returns preview result without live send", async () => {
  const prev = {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    phone: process.env.TWILIO_PHONE_NUMBER,
    safe: process.env.SB_TWILIO_SAFE_MODE
  };

  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_AUTH_TOKEN = "token_test";
  process.env.TWILIO_PHONE_NUMBER = "+15555550000";
  process.env.SB_TWILIO_SAFE_MODE = "true";

  const result = await sendTwilioMessage({
    to: "+15555550123",
    body: "Safe mode test"
  });

  expect(result.skipped).toBeFalsy();
  expect(result.mode).toBe("safe");
  expect(String(result.providerId || "")).toContain("twilio-safe-");

  process.env.TWILIO_ACCOUNT_SID = prev.sid;
  process.env.TWILIO_AUTH_TOKEN = prev.token;
  process.env.TWILIO_PHONE_NUMBER = prev.phone;
  process.env.SB_TWILIO_SAFE_MODE = prev.safe;
});

test("hubspot safe mode returns preview task result", async () => {
  const prev = {
    token: process.env.HUBSPOT_ACCESS_TOKEN,
    safe: process.env.SB_HUBSPOT_SAFE_MODE
  };

  process.env.HUBSPOT_ACCESS_TOKEN = "token_test";
  process.env.SB_HUBSPOT_SAFE_MODE = "true";

  const result = await createHubSpotTask({
    title: "Safe mode test",
    body: "Safe mode body"
  });

  expect(result.skipped).toBeFalsy();
  expect(result.mode).toBe("safe");
  expect(String(result.providerId || "")).toContain("hubspot-safe-");

  process.env.HUBSPOT_ACCESS_TOKEN = prev.token;
  process.env.SB_HUBSPOT_SAFE_MODE = prev.safe;
});
