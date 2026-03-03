"use server";

import { revalidatePath } from "next/cache";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { normalizeToE164 } from "@/lib/validators/phone";
import { logAuditEvent } from "@/lib/services/audit";
import { inngest } from "@/lib/workflows/client";
import { logEvent } from "@/lib/services/logger";

export async function createLead(formData: FormData) {
  const { accountId, role, userId, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const firstName = String(formData.get("first_name") || "");
  const lastName = String(formData.get("last_name") || "");
  const phone = String(formData.get("phone") || "");
  const email = String(formData.get("email") || "");

  const phoneE164 = phone ? normalizeToE164(phone) : null;

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      account_id: accountId,
      first_name: firstName,
      last_name: lastName,
      phone_e164: phoneE164,
      email
    })
    .select("id")
    .single();

  if (contactError) throw new Error(contactError.message);

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({ account_id: accountId, contact_id: contact.id, source: "MANUAL" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await inngest.send({ name: "lead/created", data: { accountId, leadId: lead.id } });
  logEvent("info", "lead.created", { accountId, leadId: lead.id });
  logEvent("info", "workflow.triggered", { name: "lead/created", accountId, leadId: lead.id });

  await logAuditEvent({
    accountId,
    actorUserId: userId,
    eventType: "lead_created",
    entityType: "lead",
    entityId: lead.id
  });

  revalidatePath("/pipeline");
}

export async function updateLeadStage(formData: FormData) {
  const { accountId, role, userId, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const leadId = String(formData.get("lead_id"));
  const toStage = String(formData.get("stage"));

  const { data: current, error: currentError } = await supabase
    .from("leads")
    .select("stage")
    .eq("account_id", accountId)
    .eq("id", leadId)
    .single();

  if (currentError || !current) throw new Error("Lead not found");

  const { error } = await supabase
    .from("leads")
    .update({ stage: toStage })
    .eq("account_id", accountId)
    .eq("id", leadId);

  if (error) throw new Error(error.message);

  await supabase
    .from("sequence_enrollments")
    .update({ status: "STOPPED", stopped_reason: "stage_changed" })
    .eq("account_id", accountId)
    .eq("lead_id", leadId)
    .eq("status", "ACTIVE");

  await logAuditEvent({
    accountId,
    actorUserId: userId,
    eventType: "lead_stage_changed",
    entityType: "lead",
    entityId: leadId,
    metadata: { from: current.stage, to: toStage }
  });

  if (toStage === "COMPLETED") {
    await inngest.send({ name: "job/completed", data: { accountId, leadId } });
    logEvent("info", "workflow.triggered", { name: "job/completed", accountId, leadId });
  }

  revalidatePath("/pipeline");
  revalidatePath("/conversations");
}

export async function assignLead(formData: FormData) {
  const { accountId, role, userId, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const leadId = String(formData.get("lead_id"));
  const assignedUserId = String(formData.get("assigned_user_id"));

  const { error } = await supabase
    .from("leads")
    .update({ assigned_user_id: assignedUserId })
    .eq("id", leadId)
    .eq("account_id", accountId);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    accountId,
    actorUserId: userId,
    eventType: "lead_assigned",
    entityType: "lead",
    entityId: leadId,
    metadata: { assignedUserId }
  });

  revalidatePath("/pipeline");
}
