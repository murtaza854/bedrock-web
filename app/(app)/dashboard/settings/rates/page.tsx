"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Can } from "@/components/can";

const today = () => new Date().toLocaleDateString("en-CA");
const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;
const dateStr = (d: string) => new Date(d.slice(0, 10) + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function Rates() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const load = () => get("/rates").then(setRows);
  useEffect(() => { load(); if (new URLSearchParams(location.search).get("tab") === "rates") window.scrollTo(0, 0); }, []);
  if (!rows) return null;
  const keys = [...new Set<string>(rows.map((r) => r.key))];
  // current = the latest row that has already taken effect
  const current = (k: string) => rows.filter((r) => r.key === k && r.effective_from.slice(0, 10) <= today()).sort((a, b) => b.effective_from.localeCompare(a.effective_from) || b.id - a.id)[0];
  const save = async (e: React.FormEvent<HTMLFormElement>, k: string) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const err: Errors = {};
    if (f.value === "" || !(Number(f.value) >= 0)) err.value = "Enter a rate, 0 or more";
    if (!f.effective_from) err.effective_from = "Enter the date it took effect";
    setErrors(err);
    if (Object.keys(err).length) return;
    try { await post("/rates", { key: k, value: Number(f.value), effective_from: f.effective_from, note: f.note }); }
    catch (x) { return setErrors({ form: (x as Error).message }); }
    setEdit(null); load();
  };
  const block = (side: string, title: string) => (
    <section className="border-t border-line pt-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h2>
      <ul className="mt-4 text-sm">
        {keys.filter((k) => rows.find((r) => r.key === k).side === side).map((k) => {
          const c = current(k), hs = rows.filter((r) => r.key === k);
          return (
            <li key={k} className="border-t border-line py-3.5 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-medium">{c.label}{!c.confirmed && <span className="ml-3"><Badge tone="warn">Not set</Badge></span>}</span>
                <span className="flex items-center gap-5">
                  <span>{c.confirmed ? <>{c.kind === "percent" ? `${c.value}%` : `PKR ${c.value.toLocaleString()}`}<span className="ml-2 text-xs text-muted">since {dateStr(c.effective_from)}</span></> : <span className="text-muted">counts as zero</span>}</span>
                  <Can area="rates" letter={c.confirmed ? "u" : "c"}><button onClick={() => { setErrors({}); setEdit(edit === k ? null : k); }} className="text-xs text-muted hover:text-ink">{edit === k ? "Cancel" : c.confirmed ? "Update" : "Set"}</button></Can>
                  {hs.filter((r) => r.confirmed).length > 1 && <button onClick={() => setHist(hist === k ? null : k)} className="text-xs text-muted hover:text-ink">History</button>}
                </span>
              </div>
              {c.note && c.confirmed && <p className="mt-1 text-xs text-muted">{c.note}</p>}
              {edit === k && (
                <form onSubmit={(e) => save(e, k)} noValidate className="mt-3 grid items-start gap-3 sm:grid-cols-4">
                  <div><Lbl>{c.kind === "percent" ? "New rate (%)" : "New amount (PKR)"}</Lbl><Field name="value" type="number" step="any" min="0" error={errors.value} autoFocus /></div>
                  <div><Lbl>Takes effect on</Lbl><Field name="effective_from" type="date" defaultValue={today()} error={errors.effective_from} /></div>
                  <div className="sm:col-span-2"><Lbl>Source or note (optional)</Lbl><Field name="note" placeholder="Where this rate comes from" /></div>
                  <div className="flex items-center gap-3 sm:col-span-4"><Button>Save rate</Button>{errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}</div>
                </form>
              )}
              {hist === k && <ul className="mt-3 grid gap-1 text-xs text-muted">{hs.filter((r) => r.confirmed).map((r) => <li key={r.id}>{dateStr(r.effective_from)}: {r.kind === "percent" ? `${r.value}%` : `PKR ${r.value.toLocaleString()}`}{r.note && `, ${r.note}`}</li>)}</ul>}
            </li>
          );
        })}
      </ul>
    </section>
  );
  return (
    <div className="grid gap-8">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-ink">← Settings</Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Tax and fee rates</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">Taxes and fees change. Each change is saved with the date it took effect. Rates start as "Not set" and count as zero until you enter them, so check each one with your lawyer or accountant. The financial model offers the ones you have set.</p>
      </div>
      {block("buy", "When you buy")}{block("sell", "When you sell")}
    </div>
  );
}
