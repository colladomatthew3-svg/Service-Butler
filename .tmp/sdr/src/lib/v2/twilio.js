"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTwilioMessage = sendTwilioMessage;
exports.queueTwilioVoiceTask = queueTwilioVoiceTask;
function twilioConfig() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const safeMode = String(process.env.SB_TWILIO_SAFE_MODE || "").trim().toLowerCase();
    return {
        accountSid,
        authToken,
        fromNumber,
        configured: Boolean(accountSid && authToken && fromNumber),
        safeModeByDefault: safeMode === "1" || safeMode === "true" || safeMode === "on" || safeMode === "yes"
    };
}
function buildBasicAuth(username, password) {
    return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}
async function sendTwilioMessage(input) {
    const cfg = twilioConfig();
    if (!cfg.configured || !cfg.accountSid || !cfg.authToken || !cfg.fromNumber) {
        return {
            skipped: true,
            providerId: null,
            reason: "Twilio credentials missing",
            mode: "disabled"
        };
    }
    const safeMode = input.safeMode ?? cfg.safeModeByDefault;
    if (safeMode) {
        return {
            skipped: false,
            providerId: `twilio-safe-${Date.now()}`,
            mode: "safe",
            response: {
                preview: true,
                to: input.to,
                body: input.body
            }
        };
    }
    const params = new URLSearchParams();
    params.set("To", input.to);
    params.set("From", cfg.fromNumber);
    params.set("Body", input.body);
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`, {
        method: "POST",
        headers: {
            authorization: buildBasicAuth(cfg.accountSid, cfg.authToken),
            "content-type": "application/x-www-form-urlencoded"
        },
        body: params
    });
    const payload = (await response.json().catch(() => ({})));
    if (!response.ok) {
        throw new Error(String(payload.message || payload.error_message || "Twilio SMS request failed"));
    }
    return {
        skipped: false,
        providerId: String(payload.sid || "") || null,
        mode: input.testMode ? "test" : "live",
        response: payload
    };
}
async function queueTwilioVoiceTask(input) {
    const cfg = twilioConfig();
    if (!cfg.configured) {
        return {
            skipped: true,
            providerId: null,
            reason: "Twilio credentials missing",
            mode: "disabled"
        };
    }
    const safeMode = input.safeMode ?? cfg.safeModeByDefault;
    if (safeMode) {
        return {
            skipped: false,
            providerId: `voice-safe-${Date.now()}`,
            mode: "safe",
            response: {
                queued: false,
                preview: true,
                to: input.to,
                note: input.note
            }
        };
    }
    return {
        skipped: false,
        providerId: `voice-task:${Date.now()}`,
        mode: "live",
        response: {
            queued: true,
            to: input.to,
            note: input.note
        }
    };
}
