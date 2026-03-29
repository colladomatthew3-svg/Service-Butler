import { NextRequest } from "next/server";

export type WebhookAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function verifySharedSecretWebhook(req: NextRequest, source: string): WebhookAuthResult {
  const expected = String(process.env.WEBHOOK_SHARED_SECRET || "").trim();
  if (!expected) {
    console.error(`[webhook-auth] WEBHOOK_SHARED_SECRET missing for ${source}`);
    return {
      ok: false,
      status: 503,
      error: "Webhook secret is not configured"
    };
  }

  const received = String(req.headers.get("x-servicebutler-signature") || "").trim();
  if (!received || received !== expected) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized webhook"
    };
  }

  return { ok: true };
}
