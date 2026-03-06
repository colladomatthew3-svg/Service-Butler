import { redirect } from "next/navigation";
import { JobDetailView } from "@/components/dashboard/job-detail-view";
import { getCurrentUserContext } from "@/lib/auth/rbac";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accountId, supabase } = await getCurrentUserContext();
  const { data: exists } = await supabase.from("jobs").select("id").eq("account_id", accountId).eq("id", id).maybeSingle();
  if (!exists) {
    const { data: firstJob } = await supabase.from("jobs").select("id").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (firstJob?.id) {
      redirect(`/dashboard/jobs/${firstJob.id}`);
    }
    redirect(`/dashboard/jobs?missingJob=${encodeURIComponent(id)}`);
  }

  return <JobDetailView jobId={id} />;
}
