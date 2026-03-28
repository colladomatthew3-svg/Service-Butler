"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const outbound_engine_1 = require("@/lib/services/outbound-engine");
const review_mode_1 = require("@/lib/services/review-mode");
async function GET(_req, { params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)()) {
        const csv = (0, store_1.getDemoOutboundListCsv)(id);
        if (!csv)
            return server_1.NextResponse.json({ error: "Outbound list not found" }, { status: 404 });
        return new server_1.NextResponse(csv, {
            headers: {
                "content-type": "text/csv; charset=utf-8",
                "content-disposition": `attachment; filename="outbound-list-${id}.csv"`
            }
        });
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { prospects, partners } = await (0, outbound_engine_1.fetchOutboundListRecords)({ supabase, accountId, listId: id });
    const csv = (0, outbound_engine_1.buildOutboundCsvExport)({ prospects, partners });
    return new server_1.NextResponse(csv, {
        headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="outbound-list-${id}.csv"`
        }
    });
}
