import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { createCheckoutSession } from "@/lib/services/billing";

export async function POST(req: NextRequest) {
  const { accountId, role } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = await createCheckoutSession(accountId, appUrl);

  const accept = req.headers.get("accept") || "";
  if (accept.includes("application/json")) {
    return NextResponse.json({ url });
  }

  return NextResponse.redirect(url, 303);
}
