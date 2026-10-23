"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { del, get, post, put } from "@/lib/api";
import { GROUPS, KIND, groupOf } from "@/lib/tasks";
import { localDay } from "@/lib/contacts";
import { label } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Due } from "@/components/followup-due";

const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;
const Kpi = ({ k, v, sub }: { k: string; v: number; sub?: string }) => (
  <div><p className="text-xs text-muted">{k}</p><p className="mt-1.5 text-3xl font-light tracking-tight">{v}</p><p className="mt-1 min-h-4 text-xs text-muted">{sub}</p></div>
);

type Item = { type: "task" | "reminder"; key: string; due: string | null; high: boolean; t: any };

export default function Tasks() {
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [rem, setRem] = useState<any[]>([]);
  const [plots, setPlots] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [form, setForm] = useState<"new" | any | null>(null);
  const [preset, setPreset] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const load = () => { get("/tasks").then(setTasks); get("/reminders").then(setRem); };
  useEffect(() => {
    load(); get("/plots").then(setPlots); get("/contacts").then(setPeople);
    const p = new URLSearchParams(location.search).get("plot");
    if (p) { setPreset(p); setForm("new"); }
  }, []);

  const items = useMemo<Item[]>(() => [
    ...(tasks ?? []).filter((t) => !t.done_at).map((t) => ({ type: "task" as const, key: `t${t.id}`, due: t.due_on, high: t.priority === "high", t })),
    ...rem.map((r) => ({ type: "reminder" as const, key: `r${r.kind}${r.id}`, due: r.due_on, high: false, t: r })),
  ], [tasks, rem]);
  const grouped = (g: string) => items.filter((i) => groupOf(i.due) === g)
    .sort((a, b) => (a.due ?? "9").localeCompare(b.due ?? "9") || +b.high - +a.high || a.type.localeCompare(b.type));
  const done = (tasks ?? []).filter((t) => t.done_at);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!f.title.trim()) return setErrors({ title: "Give the task a title" });
    const body = { title: f.title, notes: f.notes, due_on: f.due_on || null, priority: f.priority, plot_id: f.plot_id ? Number(f.plot_id) : null, party_id: f.party_id ? Number(f.party_id) : null };
    try { await (form === "new" ? post("/tasks", body) : put(`/tasks/${form.id}`, body)); }
    catch (x) { return setErrors({ form: (x as Error).message || "Could not save" }); }
    setForm(null); setPreset(""); load();
  };
  const toggle = async (t: any, d: boolean) => { await post(`/tasks/${t.id}/done`, { done: d }); load(); };
  const remove = async (id: number) => { await del(`/tasks/${id}`); setDeleting(null); load(); };
  const followDone = async (id: number) => { await post(`/log/${id}/done`, {}); load(); };

  if (!tasks) return null;
  const f = form && form !== "new" ? form : null;
  const open = (x: "new" | any) => { setErrors({}); setForm(form === x ? null : x); };
  const count = (g: string) => grouped(g).length;

  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted">Your own to-dos, plus reminders Bedrock raises from follow-ups and offers.</p>
        </div>
        <Button onClick={() => { setPreset(""); open("new"); }}>{form === "new" ? "Cancel" : "New task"}</Button>
      </div>

      {form && (
        <form key={f ? f.id : "new"} onSubmit={save} noValidate className="grid items-start gap-4 border-t border-line pt-5 md:grid-cols-4">
          <div className="md:col-span-2"><Lbl>Task</Lbl><Field name="title" defaultValue={f?.title} error={errors.title} autoFocus placeholder="What needs doing?" /></div>
          <div><Lbl>Due (optional)</Lbl><Field name="due_on" type="date" defaultValue={f?.due_on?.slice(0, 10)} /></div>
          <div><Lbl>Priority</Lbl><Select name="priority" label="Priority" defaultValue={f?.priority ?? "normal"} options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} /></div>
          <div className="md:col-span-2"><Lbl>About a plot (optional)</Lbl><Select name="plot_id" label="Plot" defaultValue={f ? String(f.plot_id ?? "") : preset} options={[{ value: "", label: "None" }, ...plots.map((p) => ({ value: String(p.id), label: label(p) }))]} /></div>
          <div className="md:col-span-2"><Lbl>About a contact (optional)</Lbl><Select name="party_id" label="Contact" defaultValue={f ? String(f.party_id ?? "") : ""} options={[{ value: "", label: "None" }, ...people.map((p) => ({ value: String(p.id), label: p.name }))]} /></div>
          <div className="md:col-span-4"><Lbl>Notes (optional)</Lbl><Textarea name="notes" rows={2} defaultValue={f?.notes} /></div>
          <div className="flex items-center gap-3 md:col-span-4"><Button>{f ? "Save changes" : "Add task"}</Button><button type="button" onClick={() => setForm(null)} className="text-sm text-muted hover:text-ink">Cancel</button>{errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}</div>
        </form>
      )}

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <Kpi k="Overdue" v={count("overdue")} />
        <Kpi k="Due today" v={count("today")} />
        <Kpi k="Next 7 days" v={count("week")} />
        <Kpi k="Open tasks" v={items.filter((i) => i.type === "task").length} sub={`${rem.length} reminders on top`} />
      </div>

      {GROUPS.map((g) => {
        const list = grouped(g.key);
        if (!list.length) return null;
        return (
          <section key={g.key} className="border-t border-line pt-5">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{g.label}<span className="ml-3 normal-case tracking-normal">{list.length}</span></h2>
            <ul className="mt-4 text-sm">
              {list.map((i) => i.type === "task" ? (
                <li key={i.key} className="flex items-start justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <button onClick={() => toggle(i.t, true)} aria-label={`Mark "${i.t.title}" done`} className="mt-0.5 size-4 shrink-0 rounded-full border border-muted hover:bg-accent" />
                    <div className="min-w-0">
                      <p className="font-medium">{i.t.title}{i.high && <span className="ml-2 align-middle"><Badge tone="bad">High</Badge></span>}</p>
                      {(i.t.plot_label || i.t.contact_name) && <p className="mt-0.5 text-xs text-muted">
                        {i.t.plot_label && <Link href={`/dashboard/plots/${i.t.plot_id}`} className="hover:text-ink">{i.t.plot_label}</Link>}{i.t.plot_label && i.t.contact_name && " · "}
                        {i.t.contact_name && <Link href={`/dashboard/contacts/${i.t.party_id}`} className="hover:text-ink">{i.t.contact_name}</Link>}</p>}
                      {i.t.notes && <p className="mt-1 max-w-xl whitespace-pre-line text-xs text-muted">{i.t.notes}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {i.due && <Due on={i.due} />}
                    {deleting === i.t.id ? <span className="text-xs"><button onClick={() => remove(i.t.id)} className="text-red-500">Delete</button><button onClick={() => setDeleting(null)} className="ml-3 text-muted">Keep</button></span>
                      : <span className="flex gap-3 text-xs text-muted"><button onClick={() => open(i.t)} className="hover:text-ink">Edit</button><button onClick={() => setDeleting(i.t.id)} className="hover:text-ink">Delete</button></span>}
                  </div>
                </li>
              ) : (
                <li key={i.key} className="flex items-start justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 shrink-0"><Badge tone="info">{KIND[i.t.kind]}</Badge></span>
                    <div className="min-w-0"><p className="font-medium">{i.t.title}</p><p className="mt-0.5 text-xs text-muted">{i.t.detail}</p></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {i.due && <Due on={i.due} />}
                    <span className="flex gap-3 text-xs text-muted">
                      {i.t.action === "followup_done" && <button onClick={() => followDone(i.t.id)} className="hover:text-ink">Done</button>}
                      <Link href={i.t.href} className="hover:text-ink">Open →</Link>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {!items.length && <p className="border-t border-line pt-5 text-sm text-muted">Nothing to do. Add a task, or keep going: reminders appear here on their own.</p>}

      {done.length > 0 && (
        <section className="border-t border-line pt-5">
          <button onClick={() => setShowDone(!showDone)} className="text-xs font-medium uppercase tracking-wider text-muted hover:text-ink">Completed ({done.length}) {showDone ? "−" : "+"}</button>
          {showDone && (
            <ul className="mt-4 text-sm">
              {done.slice(0, 15).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                  <span className="text-muted line-through">{t.title}</span>
                  <span className="flex gap-3 text-xs text-muted"><button onClick={() => toggle(t, false)} className="hover:text-ink">Undo</button><button onClick={() => remove(t.id)} className="hover:text-ink">Delete</button></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
