"use server";

import { revalidatePath } from "next/cache";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { normalizeToE164 } from "@/lib/validators/phone";

export async function updateSettings(formData: FormData) {
  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const twilioPhone = String(formData.get("twilio_phone_number") || "");
  const reviewLink = String(formData.get("review_link") || "");
  const quietStart = String(formData.get("quiet_hours_start") || "");
  const quietEnd = String(formData.get("quiet_hours_end") || "");
  const businessHours = String(formData.get("business_hours") || "{}");

  const { error } = await supabase.from("account_settings").upsert({
    account_id: accountId,
    twilio_phone_number: twilioPhone ? normalizeToE164(twilioPhone) : null,
    review_link: reviewLink || null,
    quiet_hours_start: quietStart || null,
    quiet_hours_end: quietEnd || null,
    business_hours: JSON.parse(businessHours)
  });

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}
