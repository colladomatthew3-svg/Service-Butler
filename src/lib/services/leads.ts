import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeToE164 } from "@/lib/validators/phone";

export async function findOrCreateContactByPhone(accountId: string, phone: string) {
  const supabase = getSupabaseAdminClient();
  const e164 = normalizeToE164(phone);

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("account_id", accountId)
    .eq("phone_e164", e164)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("contacts")
    .insert({ account_id: accountId, phone_e164: e164 })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function findOrCreateLeadByPhone(accountId: string, phone: string) {
  const supabase = getSupabaseAdminClient();
  const contactId = await findOrCreateContactByPhone(accountId, phone);

  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("account_id", accountId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (existing) return { leadId: existing.id as string, contactId };

  const { data, error } = await supabase
    .from("leads")
    .insert({ account_id: accountId, contact_id: contactId, stage: "NEW", source: "INBOUND" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { leadId: data.id as string, contactId };
}

export async function resolveAccountByTwilioNumber(toPhoneRaw: string) {
  const supabase = getSupabaseAdminClient();
  const toPhone = normalizeToE164(toPhoneRaw);

  const { data, error } = await supabase
    .from("account_settings")
    .select("account_id")
    .eq("twilio_phone_number", toPhone)
    .maybeSingle();

  if (error || !data) throw new Error("No account configured for destination number");
  return data.account_id as string;
}
