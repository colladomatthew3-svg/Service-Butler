import { notFound } from "next/navigation";
import { LeadDetailView } from "@/components/dashboard/lead-detail-view";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { isLocalBypassMode } from "@/lib/services/review-mode";

export default async function LeadDetailMockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isLocalBypassMode()) return <LeadDetailView leadId={id} />;

  const { accountId, supabase } = await getCurrentUserContext();
  const { data: exists } = await supabase.from("leads").select("id").eq("account_id", accountId).eq("id", id).maybeSingle();
  if (!exists) notFound();

  return <LeadDetailView leadId={id} />;
}
