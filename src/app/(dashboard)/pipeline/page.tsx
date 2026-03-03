import Link from "next/link";
import { createLead, updateLeadStage } from "@/actions/leads";
import { getCurrentUserContext } from "@/lib/auth/rbac";

const stages = ["NEW", "CONTACTED", "QUALIFIED", "BOOKED", "COMPLETED", "LOST"];

export default async function PipelinePage() {
  const { accountId, supabase } = await getCurrentUserContext();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, stage, contacts:contact_id(first_name,last_name,phone_e164,email)")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1>Leads Pipeline</h1>
      <div className="panel">
        <h3>Add Lead</h3>
        <form action={createLead} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(180px, 1fr))" }}>
          <input name="first_name" placeholder="First name" />
          <input name="last_name" placeholder="Last name" />
          <input name="phone" placeholder="Phone" />
          <input name="email" type="email" placeholder="Email" />
          <button type="submit">Create Lead</button>
        </form>
      </div>

      {(leads || []).map((lead) => {
        const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts;
        return (
          <div className="panel" key={lead.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{contact?.first_name || "Unknown"} {contact?.last_name || ""}</strong>
                <div>{contact?.phone_e164 || "No phone"}</div>
                <div>{contact?.email || "No email"}</div>
              </div>
              <div>
                <Link href={`/pipeline/${lead.id}`}>Open</Link>
              </div>
            </div>
            <form action={updateLeadStage} style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <input type="hidden" name="lead_id" value={lead.id} />
              <select name="stage" defaultValue={lead.stage}>
                {stages.map((stage) => (
                  <option value={stage} key={stage}>{stage}</option>
                ))}
              </select>
              <button type="submit">Update Stage</button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
