"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get, patch, post } from "@/lib/api";
import { LOG_KINDS, localDay, waNumber } from "@/lib/contacts";
import { cap, label } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { Due } from "@/components/followup-due";
import { Can } from "@/components/can";

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;
const Section = ({ title, note, action, children }: { title: string; note?: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="border-t border-line pt-5">
    <div className="flex items-baseline justify-between">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}{note && <span className="ml-3 normal-case tracking-normal">{note}</span>}</h2>{action}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

export default function Contact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<any>(null);
  const [plots, setPlots] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmArchive, setConfirmArchive] = useState(false);
  const load = () => get(`/contacts/${id}`).then(setD);
  useEffect(() => { load(); get("/plots").then(setPlots); }, [id]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const f = Object.fromEntries(new FormData(el)) as Record<string, string>;
    const err: Errors = {};
    if (!f.summary.trim()) err.summary = "Write what was discussed";
    if (f.followup_on && f.followup_on < localDay()) err.followup_on = "Pick today or a later date";
    setErrors(err);
    if (Object.keys(err).length) return;
    try { await post(`/contacts/${id}/log`, { kind: f.kind, summary: f.summary, plot_id: f.plot_id ? Number(f.plot_id) : null, followup_on: f.followup_on || null }); }
    catch { return setErrors({ form: "Could not save, try again" }); }
    setOpen(false); load();
  };
  const done = async (logId: number) => { await post(`/log/${logId}/done`, {}); load(); };
  const setMandate = async (v: boolean) => { await patch(`/contacts/${id}`, { mandate_verified: v }); load(); };
  const archive = async () => { await patch(`/contacts/${id}`, { archived: true }); location.href = "/dashboard/contacts"; };

  if (!d) return null;
  const { contact: c, log, quotes } = d;
  const wa = c.phone && waNumber(c.phone);
  const isBroker = c.roles.includes("broker");

  return (
    <div className="grid gap-10">
      <div>
        <Link href="/dashboard/contacts" className="text-sm text-muted hover:text-ink">← Contacts</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <p className="mt-1 text-sm text-muted">{c.company || "No company"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {c.roles.map((r: string) => <Badge key={r}>{cap(r)}</Badge>)}
              {isBroker && <Badge tone={c.mandate_verified ? "good" : "warn"}>{c.mandate_verified ? "Mandate verified" : "Mandate unverified"}</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Can area="contacts" letter="u"><Link href={`/dashboard/contacts/${id}/edit`} className="rounded-lg bg-line/50 px-3.5 py-2 text-sm font-medium hover:bg-line">Edit</Link></Can>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">{c.phone}</a>}
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="text-muted hover:text-ink">WhatsApp</a>}
          {c.email && <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>}
          {!c.phone && !c.email && <span className="text-muted">No phone or email yet</span>}
        </div>
        {c.notes && <p className="mt-4 max-w-2xl whitespace-pre-line text-sm text-muted">{c.notes}</p>}
        {isBroker && (
          <p className="mt-4 text-xs text-muted">
            {c.mandate_verified ? "You confirmed this broker is authorised to act for the owner." : "Not confirmed that this broker is authorised by the owner."}{" "}
            <Can area="contacts" letter="u"><button onClick={() => setMandate(!c.mandate_verified)} className="underline hover:text-ink">{c.mandate_verified ? "Mark unverified" : "Mark mandate verified"}</button></Can>
          </p>
        )}
      </div>

      <Section title="Contact log" note={`${log.length}`} action={<button onClick={() => { setErrors({}); setOpen(!open); }} className="text-sm text-muted hover:text-ink">{open ? "Cancel" : "+ Log contact"}</button>}>
        {open && (
          <form onSubmit={submit} noValidate className="mb-6 grid items-start gap-4 md:grid-cols-3">
            <div><Lbl>Type</Lbl><Select name="kind" label="Contact type" defaultValue="call" options={LOG_KINDS.map((k) => ({ value: k, label: cap(k) }))} /></div>
            <div><Lbl>About a plot (optional)</Lbl><Select name="plot_id" label="Plot" defaultValue="" options={[{ value: "", label: "None" }, ...plots.map((p) => ({ value: String(p.id), label: label(p) }))]} /></div>
            <div><Lbl>Follow up on (optional)</Lbl><Field name="followup_on" type="date" min={localDay()} error={errors.followup_on} /></div>
            <div className="md:col-span-3"><Lbl>What happened</Lbl><Textarea name="summary" rows={2} aria-invalid={!!errors.summary} autoFocus />
              {errors.summary && <p role="alert" className="mt-1.5 text-xs text-red-500">{errors.summary}</p>}</div>
            <div className="flex items-center gap-3 md:col-span-3"><Button>Save</Button>{errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}</div>
          </form>
        )}
        {log.length ? (
          <ul className="text-sm">
            {log.map((l: any) => (
              <li key={l.id} className="grid gap-x-4 border-t border-line py-3 first:border-t-0 first:pt-0 sm:grid-cols-[7rem_1fr_auto]">
                <span className="text-muted">{when(l.created_at)}</span>
                <span><Badge>{cap(l.kind)}</Badge> <span className="ml-1">{l.summary}</span>
                  {l.plot_label && <Link href={`/dashboard/plots/${l.plot_id}`} className="ml-2 text-muted hover:text-ink">{l.plot_label}</Link>}</span>
                <span className="flex items-center gap-3 sm:justify-end">
                  {l.followup_on && (l.followup_done_at ? <span className="text-xs text-muted">Follow-up done</span> : <><Due on={l.followup_on} /><button onClick={() => done(l.id)} className="text-xs text-muted hover:text-ink">Done</button></>)}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Nothing logged yet. Record calls and messages here so nothing gets lost.</p>}
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Quotes" note={quotes.length ? `${quotes.length}, matched by name` : undefined}>
          {quotes.length ? (
            <ul className="text-sm">{quotes.slice(0, 6).map((q: any) => (
              <li key={q.id} className="flex items-center justify-between border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <Link href={`/dashboard/plots/${q.plot_id}`} className="font-medium">{q.plot_label}</Link>
                <span className="text-muted">PKR {q.price_pkr.toLocaleString()} · {cap(q.quote_type)}</span>
              </li>))}</ul>
          ) : <p className="text-sm text-muted">No quotes recorded under this exact name.</p>}
        </Section>
      </div>

      <div className="border-t border-line pt-5 text-sm">
        {confirmArchive ? (
          <span>Archive this contact? Their log is kept. <button onClick={archive} className="ml-2 text-red-500">Archive</button> <button onClick={() => setConfirmArchive(false)} className="ml-3 text-muted">Keep</button></span>
        ) : <button onClick={() => setConfirmArchive(true)} className="text-muted hover:text-ink">Archive contact</button>}
      </div>
    </div>
  );
}
