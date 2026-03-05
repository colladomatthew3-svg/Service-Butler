import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { getAccountBillingState } from "@/lib/services/account-billing";
import { DashboardAppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const demoMode = process.env.NODE_ENV === "development" && process.env.DEMO_MODE === "on";
  let accountId: string;
  try {
    ({ accountId } = await getCurrentUserContext());
  } catch {
    redirect("/login");
  }

  const billing = await getAccountBillingState(accountId);

  const showWarning = !billing.allowed || billing.allowedReason === "dev_override";
  const bannerText =
    billing.allowedReason === "dev_override"
      ? `Outbound allowed because dev override is enabled. Stripe subscription: ${billing.status}.`
      : billing.allowedReason === "billing_disabled"
        ? "Billing is disabled in MVP mode. Outbound features are available."
        : `Outbound sending is locked. Current subscription status: ${billing.status}.`;

  return (
    <DashboardAppShell
      demoMode={demoMode}
      onSignOut={
        <div className="space-y-3">
          <Link href="/billing" className="block">
            <Button variant="secondary" fullWidth>
              Billing
            </Button>
          </Link>
          <Link href="/pipeline" className="block">
            <Button variant="ghost" fullWidth>
              Legacy Pipeline
            </Button>
          </Link>
          <form action={signOut}>
            <Button variant="danger" fullWidth type="submit">
              Sign out
            </Button>
          </form>
        </div>
      }
    >
      {(showWarning || billing.allowedReason === "billing_disabled") && (
        <Card className="mb-6">
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge
                variant={
                  billing.allowedReason === "billing_disabled"
                    ? "brand"
                    : billing.allowedReason === "dev_override"
                      ? "success"
                      : "danger"
                }
              >
                {billing.allowed ? "Outbound enabled" : "Outbound locked"}
              </Badge>
              <p className="mt-2 text-sm text-neutral-700">{bannerText}</p>
            </div>
            <Link href="/billing">
              <Button variant="secondary">Open Billing</Button>
            </Link>
          </CardBody>
        </Card>
      )}
      {children}
    </DashboardAppShell>
  );
}
