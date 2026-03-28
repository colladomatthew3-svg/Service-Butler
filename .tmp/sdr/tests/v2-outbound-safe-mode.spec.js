"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const twilio_1 = require("../src/lib/v2/twilio");
const hubspot_1 = require("../src/lib/v2/hubspot");
(0, test_1.test)("twilio safe mode returns preview result without live send", async () => {
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
    const result = await (0, twilio_1.sendTwilioMessage)({
        to: "+15555550123",
        body: "Safe mode test"
    });
    (0, test_1.expect)(result.skipped).toBeFalsy();
    (0, test_1.expect)(result.mode).toBe("safe");
    (0, test_1.expect)(String(result.providerId || "")).toContain("twilio-safe-");
    process.env.TWILIO_ACCOUNT_SID = prev.sid;
    process.env.TWILIO_AUTH_TOKEN = prev.token;
    process.env.TWILIO_PHONE_NUMBER = prev.phone;
    process.env.SB_TWILIO_SAFE_MODE = prev.safe;
});
(0, test_1.test)("hubspot safe mode returns preview task result", async () => {
    const prev = {
        token: process.env.HUBSPOT_ACCESS_TOKEN,
        safe: process.env.SB_HUBSPOT_SAFE_MODE
    };
    process.env.HUBSPOT_ACCESS_TOKEN = "token_test";
    process.env.SB_HUBSPOT_SAFE_MODE = "true";
    const result = await (0, hubspot_1.createHubSpotTask)({
        title: "Safe mode test",
        body: "Safe mode body"
    });
    (0, test_1.expect)(result.skipped).toBeFalsy();
    (0, test_1.expect)(result.mode).toBe("safe");
    (0, test_1.expect)(String(result.providerId || "")).toContain("hubspot-safe-");
    process.env.HUBSPOT_ACCESS_TOKEN = prev.token;
    process.env.SB_HUBSPOT_SAFE_MODE = prev.safe;
});
