export const ROLES = ["broker", "owner", "lawyer", "architect", "engineer", "contractor", "authority", "other"];
export const LOG_KINDS = ["call", "whatsapp", "meeting", "email", "note"];
export const localDay = (d = new Date()) => d.toLocaleDateString("en-CA"); // yyyy-mm-dd, local

// "0300 1234567" -> "923001234567" for wa.me. ponytail: assumes Pakistani numbers when there is no country code.
export function waNumber(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return null;
  return d.startsWith("00") ? d.slice(2) : d.startsWith("0") ? "92" + d.slice(1) : d;
}

export function ago(iso?: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days < 1 ? "today" : days === 1 ? "yesterday" : days < 31 ? `${days}d ago` : days < 365 ? `${Math.floor(days / 30)}mo ago` : `${Math.floor(days / 365)}y ago`;
}

// follow-up state against today's local date
export function dueState(on: string): "overdue" | "today" | "later" {
  const d = on.slice(0, 10), t = localDay();
  return d < t ? "overdue" : d === t ? "today" : "later";
}
