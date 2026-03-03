import twilio from "twilio";

export function parseTwilioRawForm(rawBody: string) {
  const params = new URLSearchParams(rawBody);
  return Object.fromEntries(params.entries());
}

export function validateTwilioRequest(signature: string | null, url: string, payload: Record<string, string>) {
  if (!process.env.TWILIO_AUTH_TOKEN || !signature) return false;
  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, payload);
}
