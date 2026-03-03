import { updateSettings } from "@/actions/settings";
import { getCurrentUserContext } from "@/lib/auth/rbac";

export default async function SettingsPage() {
  const { accountId, supabase } = await getCurrentUserContext();

  const { data: settings } = await supabase
    .from("account_settings")
    .select("twilio_phone_number,review_link,quiet_hours_start,quiet_hours_end,business_hours")
    .eq("account_id", accountId)
    .maybeSingle();

  return (
    <div>
      <h1>Settings</h1>
      <div className="panel">
        <form action={updateSettings} style={{ display: "grid", gap: 8 }}>
          <input name="twilio_phone_number" defaultValue={settings?.twilio_phone_number || ""} placeholder="Twilio Number (+1...)" />
          <input name="review_link" defaultValue={settings?.review_link || ""} placeholder="Review URL" />
          <label>
            Quiet Hours Start
            <input type="time" name="quiet_hours_start" defaultValue={settings?.quiet_hours_start || ""} />
          </label>
          <label>
            Quiet Hours End
            <input type="time" name="quiet_hours_end" defaultValue={settings?.quiet_hours_end || ""} />
          </label>
          <textarea
            name="business_hours"
            rows={6}
            defaultValue={JSON.stringify(settings?.business_hours || { mon: "08:00-17:00", tue: "08:00-17:00" }, null, 2)}
          />
          <button type="submit">Save Settings</button>
        </form>
      </div>
    </div>
  );
}
