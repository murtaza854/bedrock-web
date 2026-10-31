"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Due } from "@/components/followup-due";
import { Can } from "@/components/can";

export function TaskSummary({ plotId }: { plotId: string }) {
  const [tasks, setTasks] = useState<any[] | null>(null);
  const load = () => get("/tasks").then((t) => setTasks(t.filter((x: any) => String(x.plot_id) === plotId && !x.done_at)));
  useEffect(() => { load(); }, [plotId]);
  if (!tasks) return null;
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Tasks<span className="ml-3 normal-case tracking-normal">{tasks.length} open</span></h2>
        <span className="flex gap-5 text-sm"><Link href="/dashboard/tasks" className="text-muted hover:text-ink">All tasks →</Link><Can area="tasks"><Link href={`/dashboard/tasks?plot=${plotId}`} className="text-muted hover:text-ink">+ Add task</Link></Can></span>
      </div>
      {tasks.length ? (
        <ul className="mt-4 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0">
              <span className="flex items-center gap-3"><Can area="tasks" letter="u"><button onClick={async () => { await post(`/tasks/${t.id}/done`, { done: true }); load(); }} aria-label={`Mark "${t.title}" done`} className="size-4 shrink-0 rounded-full border border-muted hover:bg-accent" /></Can>{t.title}{t.priority === "high" && <Badge tone="bad">High</Badge>}</span>
              {t.due_on && <Due on={t.due_on} />}
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-muted">No open tasks for this plot.</p>}
    </section>
  );
}
