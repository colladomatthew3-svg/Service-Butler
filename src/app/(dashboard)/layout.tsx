import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/actions/auth";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { getAccountBillingState } from "@/lib/services/account-billing";
import { isDemoMode } from "@/lib/services/review-mode";
import { DashboardAppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const demoMode = isDemoMode();
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
          <Link href="/billing" className={buttonStyles({ variant: "secondary", fullWidth: true, className: "border-white/10 bg-white/8 text-white hover:bg-white/14 hover:text-white" })}>
            Billing
          </Link>
          <Link href="/pipeline" className={buttonStyles({ variant: "ghost", fullWidth: true, className: "text-white/72 hover:bg-white/8 hover:text-white" })}>
            Legacy Pipeline
          </Link>
          <form action={signOut}>
            <Button variant="danger" fullWidth type="submit" className="border border-white/8 bg-white text-neutral-950 hover:bg-white/92">
              Sign out
            </Button>
          </form>
        </div>
      }
    >
      {(showWarning || billing.allowedReason === "billing_disabled") && (
        <Card className="mb-6 overflow-hidden border-semantic-border/60 bg-white/72 shadow-[0_14px_45px_rgba(31,42,36,0.06)]">
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
            <Link href="/billing" className={buttonStyles({ variant: "secondary" })}>
              Open Billing
            </Link>
          </CardBody>
        </Card>
      )}
      {children}
    </DashboardAppShell>
  );
}
