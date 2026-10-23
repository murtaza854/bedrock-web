export const STATUS_TONE: Record<string, string> = { open: "info", accepted: "good", rejected: "bad", withdrawn: "neutral", expired: "warn" };
export const money = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
export const today = () => new Date().toLocaleDateString("en-CA");
export const dayStr = (d?: string | null) => (d ? new Date(d.slice(0, 10) + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-");

// where a negotiation stands, from its live (not voided) rounds
export function position(n: any) {
  const live: any[] = n.rounds.filter((r: any) => !r.voided_at);
  const last = live[live.length - 1];
  const ours = [...live].reverse().find((r) => r.side === "ours");
  const theirs = [...live].reverse().find((r) => r.side === "theirs");
  const gap = ours && theirs ? Math.abs(theirs.amount_pkr - ours.amount_pkr) : null;
  const open = n.status === "open";
  const lapsed = open && last?.valid_until && last.valid_until.slice(0, 10) < today();
  // the next move belongs to whoever did not make the latest round
  const turn = !open || !last ? null : lapsed ? "lapsed" : last.side === "ours" ? "them" : "us";
  return { live, last, ours, theirs, gap, turn, lapsed, activity: last?.made_on as string | undefined };
}

export const TURN: Record<string, { label: string; tone: string }> = {
  us: { label: "Your move", tone: "warn" }, them: { label: "Waiting on them", tone: "neutral" }, lapsed: { label: "Offer lapsed", tone: "bad" },
};
