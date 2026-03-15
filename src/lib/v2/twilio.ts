function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  return { accountSid, authToken, fromNumber, configured: Boolean(accountSid && authToken && fromNumber) };
}

function buildBasicAuth(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

export async function sendTwilioMessage(input: { to: string; body: string }) {
  const cfg = twilioConfig();
  if (!cfg.configured || !cfg.accountSid || !cfg.authToken || !cfg.fromNumber) {
    return {
      skipped: true,
      providerId: null,
      reason: "Twilio credentials missing"
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

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.message || payload.error_message || "Twilio SMS request failed"));
  }

  return {
    skipped: false,
    providerId: String(payload.sid || "") || null,
    response: payload
  };
}

export async function queueTwilioVoiceTask(input: { to: string; note: string }) {
  const cfg = twilioConfig();
  if (!cfg.configured) {
    return {
      skipped: true,
      providerId: null,
      reason: "Twilio credentials missing"
    };
  }

  return {
    skipped: false,
    providerId: `voice-task:${Date.now()}`,
    response: {
      queued: true,
      to: input.to,
      note: input.note
    }
  };
}
