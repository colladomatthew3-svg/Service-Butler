import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { getDemoOutboundListCsv } from "@/lib/demo/store";
import { buildOutboundCsvExport, fetchOutboundListRecords } from "@/lib/services/outbound-engine";
import { isDemoMode } from "@/lib/services/review-mode";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode()) {
    const csv = getDemoOutboundListCsv(id);
    if (!csv) return NextResponse.json({ error: "Outbound list not found" }, { status: 404 });
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="outbound-list-${id}.csv"`
      }
    });
  }

  const { accountId, supabase } = await getCurrentUserContext();
  const { prospects, partners } = await fetchOutboundListRecords({ supabase, accountId, listId: id });
  const csv = buildOutboundCsvExport({ prospects, partners });
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="outbound-list-${id}.csv"`
    }
  });
}
