export type BillingMode = "disabled" | "stripe";

export function getBillingMode(): BillingMode {
  return process.env.BILLING_MODE === "stripe" ? "stripe" : "disabled";
}

export function isBillingDisabled() {
  return getBillingMode() === "disabled";
}
