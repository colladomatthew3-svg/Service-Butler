"use server";

import { revalidatePath } from "next/cache";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";

export async function createCampaign(formData: FormData) {
  const { accountId, role, userId, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const name = String(formData.get("name") || "");
  const channel = String(formData.get("channel") || "SMS");
  const stage = String(formData.get("stage") || "NEW");
  const subject = String(formData.get("subject") || "");
  const body = String(formData.get("body") || "");

  if (!name || !body) throw new Error("Name and body are required");

  const { error } = await supabase.from("campaigns").insert({
    account_id: accountId,
    name,
    channel,
    message_subject: subject || null,
    message_body: body,
    status: "DRAFT",
    segment_filter: { stage },
    created_by_user_id: userId
  });

  if (error) throw new Error(error.message);

  revalidatePath("/campaigns");
}
