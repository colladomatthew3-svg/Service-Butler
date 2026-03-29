function lower(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeDestinationForChannel(channel: string, value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (channel === "sms" || channel === "voice") {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    return null;
  }

  if (channel === "email") {
    const email = lower(raw);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }

  return raw;
}

export function extractLeadChannelDestination(
  channel: "sms" | "email" | "voice" | "crm_task",
  contactChannels: Record<string, unknown> | null | undefined
) {
  const channels = contactChannels || {};
  if (channel === "sms" || channel === "voice") {
    return normalizeDestinationForChannel(channel, channels.phone || channels.mobile || channels.voice);
  }
  if (channel === "email") {
    return normalizeDestinationForChannel(channel, channels.email);
  }
  return null;
}
