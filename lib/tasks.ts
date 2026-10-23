import { localDay } from "./contacts";

export const KIND: Record<string, string> = { followup: "Follow-up", offer: "Offer", reply: "Offer" };
export const GROUPS = [
  { key: "overdue", label: "Overdue" }, { key: "today", label: "Today" }, { key: "week", label: "Next 7 days" },
  { key: "later", label: "Later" }, { key: "none", label: "No date" },
];

// whole days from today to a yyyy-mm-dd date (negative = past)
export function daysFrom(d: string): number {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number), [ty, tm, td] = localDay().split("-").map(Number);
  return Math.round((new Date(y, m - 1, day).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000);
}
export const groupOf = (due?: string | null) => {
  if (!due) return "none";
  const n = daysFrom(due);
  return n < 0 ? "overdue" : n === 0 ? "today" : n <= 7 ? "week" : "later";
};
