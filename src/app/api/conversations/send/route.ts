import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext, assertRole } from "@/lib/auth/rbac";
import { sendSms } from "@/lib/services/sms";
import { sendEmail } from "@/lib/services/email";

async function parseBody(req: NextRequest) {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) return req.json();
  const form = await req.formData();
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

export async function POST(req: NextRequest) {
  const { accountId, role, userId } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = await parseBody(req);
  const { leadId, channel, to, message, subject } = body;

  if (!leadId || !channel || !to || !message) {
    return NextResponse.json({ error: "leadId, channel, to, message are required" }, { status: 400 });
  }

  if (channel === "SMS") {
    const result = await sendSms({ accountId, leadId, to, body: message, actorUserId: userId });
    return NextResponse.json({ ok: true, messageId: result.id });
  }

  if (channel === "EMAIL") {
    const result = await sendEmail({
      accountId,
      leadId,
      to,
      subject: subject || "Message from ServiceButler.ai",
      htmlBody: message,
      textBody: message.replace(/<[^>]+>/g, ""),
      actorUserId: userId
    });
    return NextResponse.json({ ok: true, messageId: result.id });
  }

  return NextResponse.json({ error: "Unsupported channel" }, { status: 400 });
}
