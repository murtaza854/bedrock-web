export const DECISIONS = [
  { value: "shortlist", label: "Shortlist", tone: "info" },
  { value: "hold", label: "Hold", tone: "warn" },
  { value: "reject", label: "Reject", tone: "bad" },
  { value: "buy", label: "Buy", tone: "good" },
];
export const STATUS: Record<string, { label: string; tone: string }> = {
  scored: { label: "Scored", tone: "good" },
  unverified: { label: "Unverified", tone: "warn" },
  unknown: { label: "Unknown", tone: "neutral" },
  conflict: { label: "Conflict", tone: "bad" },
};
// how much evidence stands behind a value
export const EVIDENCE_TONE: Record<string, string> = {
  claimed: "neutral", ai_unverified: "warn", site_verified: "violet", document_verified: "info", authority_confirmed: "good",
  "confirmed quote": "good", "asking price": "warn", measured: "info", none: "neutral",
};
export const num = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
