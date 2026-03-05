import { notFound } from "next/navigation";
import { JobDetailView } from "@/components/dashboard/job-detail-view";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { isLocalBypassMode } from "@/lib/services/review-mode";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isLocalBypassMode()) return <JobDetailView jobId={id} />;

  const { accountId, supabase } = await getCurrentUserContext();
  const { data: exists } = await supabase.from("jobs").select("id").eq("account_id", accountId).eq("id", id).maybeSingle();

  if (!exists) notFound();

  return <JobDetailView jobId={id} />;
}
