"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LeadDetailPage;
const leads_1 = require("@/actions/leads");
const rbac_1 = require("@/lib/auth/rbac");
const stages = ["NEW", "CONTACTED", "QUALIFIED", "BOOKED", "COMPLETED", "LOST"];
async function LeadDetailPage({ params }) {
    const { leadId } = await params;
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data: lead } = await supabase
        .from("leads")
        .select("id, stage, source, created_at, contacts:contact_id(first_name,last_name,phone_e164,email), messages(id,body,direction,channel,created_at,status)")
        .eq("account_id", accountId)
        .eq("id", leadId)
        .single();
    if (!lead)
        return <div className="panel">Lead not found</div>;
    const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts;
    return (<div>
      <h1>Lead Detail</h1>
      <div className="panel">
        <div><strong>Name:</strong> {contact?.first_name || "Unknown"} {contact?.last_name || ""}</div>
        <div><strong>Phone:</strong> {contact?.phone_e164 || "-"}</div>
        <div><strong>Email:</strong> {contact?.email || "-"}</div>
        <div><strong>Source:</strong> {lead.source || "-"}</div>
      </div>

      <div className="panel">
        <form action={leads_1.updateLeadStage} style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="lead_id" value={lead.id}/>
          <select name="stage" defaultValue={lead.stage}>
            {stages.map((stage) => (<option key={stage} value={stage}>{stage}</option>))}
          </select>
          <button type="submit">Save Stage</button>
        </form>
      </div>

      <div className="panel">
        <h3>Conversation Thread</h3>
        {(lead.messages || []).map((m) => (<div key={m.id} className="border-t border-semantic-border py-2">
            <strong>{m.direction} {m.channel}</strong>
            <div>{m.body}</div>
          </div>))}
      </div>
    </div>);
}
