import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { verifySharedSecretWebhook } from "../src/lib/v2/webhook-auth";

test("webhook auth fails closed when secret is missing", async () => {
  const previous = process.env.WEBHOOK_SHARED_SECRET;
  delete process.env.WEBHOOK_SHARED_SECRET;

  const req = new NextRequest("http://localhost/api/webhooks/test", {
    method: "POST"
  });

  const result = verifySharedSecretWebhook(req, "test.route");
  expect(result.ok).toBeFalsy();
  if (!result.ok) {
    expect(result.status).toBe(503);
  }

  process.env.WEBHOOK_SHARED_SECRET = previous;
});

test("webhook auth rejects wrong signature and accepts correct signature", async () => {
  const previous = process.env.WEBHOOK_SHARED_SECRET;
  process.env.WEBHOOK_SHARED_SECRET = "top-secret";

  const badReq = new NextRequest("http://localhost/api/webhooks/test", {
    method: "POST",
    headers: { "x-servicebutler-signature": "wrong" }
  });
  const badResult = verifySharedSecretWebhook(badReq, "test.route");
  expect(badResult.ok).toBeFalsy();
  if (!badResult.ok) {
    expect(badResult.status).toBe(401);
  }

  const goodReq = new NextRequest("http://localhost/api/webhooks/test", {
    method: "POST",
    headers: { "x-servicebutler-signature": "top-secret" }
  });
  const goodResult = verifySharedSecretWebhook(goodReq, "test.route");
  expect(goodResult.ok).toBeTruthy();

  process.env.WEBHOOK_SHARED_SECRET = previous;
});
