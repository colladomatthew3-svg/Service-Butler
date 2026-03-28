"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = JobDetailPage;
const navigation_1 = require("next/navigation");
const job_detail_view_1 = require("@/components/dashboard/job-detail-view");
const rbac_1 = require("@/lib/auth/rbac");
async function JobDetailPage({ params }) {
    const { id } = await params;
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data: exists } = await supabase.from("jobs").select("id").eq("account_id", accountId).eq("id", id).maybeSingle();
    if (!exists) {
        const { data: firstJob } = await supabase.from("jobs").select("id").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (firstJob?.id) {
            (0, navigation_1.redirect)(`/dashboard/jobs/${firstJob.id}`);
        }
        (0, navigation_1.redirect)(`/dashboard/jobs?missingJob=${encodeURIComponent(id)}`);
    }
    return <job_detail_view_1.JobDetailView jobId={id}/>;
}
