import Link from "next/link";
import { signOut } from "@/actions/auth";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { getAccountBillingState } from "@/lib/services/account-billing";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { accountId } = await getCurrentUserContext();
  const billing = await getAccountBillingState(accountId);

  const showWarning = !billing.allowed || billing.allowedReason === "dev_override";

  return (
    <main>
      {showWarning && (
        <div
          className="panel"
          style={{
            borderColor: billing.allowedReason === "dev_override" ? "#0a7f5a" : "#b22222",
            background: billing.allowedReason === "dev_override" ? "#f2fff7" : "#fff4f4",
            color: billing.allowedReason === "dev_override" ? "#0a583f" : "#7a0000"
          }}
        >
          {billing.allowedReason === "dev_override"
            ? `Outbound allowed because dev override is enabled. Stripe subscription status: ${billing.status}.`
            : `Outbound sending is locked. Current subscription status: ${billing.status}. Update billing to resume SMS/email/voice.`}
        </div>
      )}

      <nav>
        <Link href="/pipeline">Pipeline</Link>
        <Link href="/conversations">Conversations</Link>
        <Link href="/campaigns">Campaigns</Link>
        <Link href="/settings">Settings</Link>
        <Link href="/billing">Billing</Link>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </nav>
      {children}
    </main>
  );
}
