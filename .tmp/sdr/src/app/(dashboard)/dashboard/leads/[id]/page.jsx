"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LeadDetailMockPage;
const navigation_1 = require("next/navigation");
const lead_detail_view_1 = require("@/components/dashboard/lead-detail-view");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const review_mode_1 = require("@/lib/services/review-mode");
async function LeadDetailMockPage({ params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)()) {
        const exists = (0, store_1.getDemoLead)(id);
        if (!exists) {
            const firstLeadId = (0, store_1.getFirstDemoLeadId)();
            if (firstLeadId) {
                (0, navigation_1.redirect)(`/dashboard/leads/${firstLeadId}`);
            }
            (0, navigation_1.redirect)(`/dashboard/leads?missingLead=${encodeURIComponent(id)}`);
        }
        return <lead_detail_view_1.LeadDetailView leadId={id}/>;
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data: exists } = await supabase.from("leads").select("id").eq("account_id", accountId).eq("id", id).maybeSingle();
    if (!exists) {
        const { data: firstLead } = await supabase.from("leads").select("id").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (firstLead?.id) {
            (0, navigation_1.redirect)(`/dashboard/leads/${firstLead.id}`);
        }
        (0, navigation_1.redirect)(`/dashboard/leads?missingLead=${encodeURIComponent(id)}`);
    }
    return <lead_detail_view_1.LeadDetailView leadId={id}/>;
}
