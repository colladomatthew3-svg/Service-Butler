import { isBillingDisabled } from "@/lib/services/billing-mode";

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const disabled = isBillingDisabled();

  return (
    <div>
      <h1>Billing</h1>

      {disabled && (
        <div className="panel" style={{ borderColor: "#3f6a9a", background: "#eef6ff" }}>
          Billing disabled in MVP.
        </div>
      )}

      {!disabled && params.success === "1" && (
        <div className="panel" style={{ borderColor: "#0a7f5a", background: "#f2fff7" }}>
          Subscription checkout completed. Stripe webhook will sync subscription status shortly.
        </div>
      )}

      {!disabled && params.canceled === "1" && (
        <div className="panel" style={{ borderColor: "#b36b00", background: "#fff8eb" }}>
          Checkout canceled. You can start again anytime.
        </div>
      )}

      {!disabled && (
        <>
          <div className="panel">
            <p>Start a Stripe test subscription for this account.</p>
            <form action="/api/billing/checkout" method="post">
              <button type="submit">Start Subscription</button>
            </form>
          </div>

          <div className="panel">
            <p>Manage your subscription and payment details in Stripe Customer Portal.</p>
            <form action="/api/billing/portal" method="post">
              <button type="submit">Open Stripe Portal</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
