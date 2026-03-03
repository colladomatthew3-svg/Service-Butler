import { getCurrentUserContext } from "@/lib/auth/rbac";

export default async function ConversationsPage() {
  const { accountId, supabase } = await getCurrentUserContext();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, contacts:contact_id(first_name,last_name,phone_e164,email), messages(id,direction,channel,body,created_at)")
    .eq("account_id", accountId);

  return (
    <div>
      <h1>Conversations</h1>
      {(leads || []).map((lead) => {
        const contact = Array.isArray(lead.contacts) ? lead.contacts[0] : lead.contacts;
        const recent = [...(lead.messages || [])].sort((a, b) => (a.created_at > b.created_at ? -1 : 1)).slice(0, 5);

        return (
          <div className="panel" key={lead.id}>
            <h3>{contact?.first_name || "Unknown"} {contact?.last_name || ""}</h3>
            <div style={{ marginBottom: 8 }}>{contact?.phone_e164 || contact?.email || "No contact"}</div>
            <form action="/api/conversations/send" method="post" style={{ display: "grid", gap: 8 }}>
              <input type="hidden" name="leadId" value={lead.id} />
              <select name="channel" defaultValue="SMS">
                <option value="SMS">SMS</option>
                <option value="EMAIL">Email</option>
              </select>
              <input name="to" placeholder="Recipient" defaultValue={contact?.phone_e164 || contact?.email || ""} />
              <input name="subject" placeholder="Subject (email only)" />
              <textarea name="message" placeholder="Message" rows={3} />
              <button type="submit">Send</button>
            </form>
            <div style={{ marginTop: 10 }}>
              {recent.map((m) => (
                <div key={m.id}><strong>{m.direction}</strong>: {m.body}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
