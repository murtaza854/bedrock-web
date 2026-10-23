import { Badge } from "@/components/ui/badge";
import { dueState } from "@/lib/contacts";

export function Due({ on }: { on: string }) {
  const s = dueState(on);
  const text = new Date(on.slice(0, 10) + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return s === "overdue" ? <Badge tone="bad">Overdue · {text}</Badge> : s === "today" ? <Badge tone="warn">Today</Badge> : <span className="text-muted">{text}</span>;
}
