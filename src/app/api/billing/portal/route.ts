import { NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { createBillingPortalSession } from "@/lib/services/billing";

export async function POST() {
  const { accountId, role } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`;
  const url = await createBillingPortalSession(accountId, returnUrl);

  if (!url) {
    return NextResponse.json(
      {
        error: "No Stripe customer found for this account. Subscribe first via Billing > Start Subscription."
      },
      { status: 400 }
    );
  }

  return NextResponse.redirect(url, 303);
}
