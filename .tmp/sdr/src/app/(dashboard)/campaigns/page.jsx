"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CampaignsPage;
const campaigns_1 = require("@/actions/campaigns");
const rbac_1 = require("@/lib/auth/rbac");
async function CampaignsPage() {
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id,name,channel,status,segment_filter,created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
    const { data: deliveries } = await supabase
        .from("campaign_deliveries")
        .select("campaign_id,status")
        .eq("account_id", accountId);
    const counts = (deliveries || []).reduce((acc, d) => {
        const key = d.campaign_id;
        if (!acc[key])
            acc[key] = { sent: 0, failed: 0 };
        if (d.status === "SENT")
            acc[key].sent += 1;
        if (d.status === "FAILED")
            acc[key].failed += 1;
        return acc;
    }, {});
    return (<div>
      <h1>Campaigns</h1>
      <div className="panel">
        <h3>Create Campaign</h3>
        <form action={campaigns_1.createCampaign} style={{ display: "grid", gap: 8 }}>
          <input name="name" placeholder="Campaign name" required/>
          <select name="channel" defaultValue="SMS">
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
          </select>
          <select name="stage" defaultValue="NEW">
            <option value="NEW">New leads</option>
            <option value="QUALIFIED">Qualified leads</option>
            <option value="BOOKED">Booked leads</option>
          </select>
          <input name="subject" placeholder="Email subject"/>
          <textarea name="body" rows={4} placeholder="Message" required/>
          <button type="submit">Save Draft</button>
        </form>
      </div>

      {(campaigns || []).map((campaign) => (<div className="panel" key={campaign.id}>
          <div><strong>{campaign.name}</strong> ({campaign.channel})</div>
          <div>Status: {campaign.status}</div>
          <div>Segment: stage={campaign.segment_filter?.stage || "NEW"}</div>
          <div>
            Delivery: sent {counts[campaign.id]?.sent || 0}, failed {counts[campaign.id]?.failed || 0}
          </div>
          <form action="/api/campaigns/send" method="post" style={{ marginTop: 8 }}>
            <input type="hidden" name="campaignId" value={campaign.id}/>
            <button type="submit">Send Campaign</button>
          </form>
        </div>))}
    </div>);
}
