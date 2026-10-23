"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { metres } from "@/lib/geo";
import { cap, label, ppsy } from "@/lib/plots";
import { position } from "@/lib/offers";
import { useSettings } from "@/lib/settings";

const money = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-");
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-1.5 border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{children}</h2>;
const Big = ({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) => <div><p className="text-[9px] uppercase tracking-wide text-neutral-500">{k}</p><p className="text-lg font-light leading-tight">{v}</p>{sub && <p className="text-[9px] text-neutral-500">{sub}</p>}</div>;

// One page, built to print: Print or Save as PDF from the browser.
export default function Report({ params }: { params: Promise<{ id: string }> }) {
  const cfg = useSettings();
  const { id } = use(params);
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    Promise.all([get(`/plots/${id}`), get(`/plots/${id}/score`), get(`/plots/${id}/buildable`), get(`/plots/${id}/comparables`),
      get(`/plots/${id}/negotiations`).catch(() => []), get(`/plots/${id}/distances`), get("/tasks")])
      .then(([plot, score, build, comps, negs, near, tasks]) => setD({ plot, score, build, comps, negs, near, tasks }));
  }, [id]);
  if (!d) return null;
  const { plot: P, score: S, build: B, comps: C, negs, near, tasks } = d, p = P.plot;
  const open = negs.filter((n: any) => n.status === "open"), myTasks = tasks.filter((t: any) => t.plot_id === p.id && !t.done_at);
  const sections = S.sections.filter((s: any) => s.weight > 0);

  return (
    <div className="mx-auto max-w-[190mm] text-[11px] leading-snug text-neutral-900 print:max-w-none">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/dashboard/plots/${id}`} className="text-sm text-muted hover:text-ink">← {label(p)}</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg hover:opacity-90">Print or save as PDF</button>
      </div>
      <div className="rounded-lg border border-neutral-300 bg-white p-6 print:rounded-none print:border-0 print:p-0">
        <header className="flex items-end justify-between border-b-2 border-neutral-900 pb-2">
          <div><p className="text-[9px] uppercase tracking-widest text-neutral-500">{cfg.project_name ? `${cfg.project_name} · ` : "Bedrock · "}plot report</p><h1 className="text-xl font-semibold">{label(p)}</h1>
            <p className="text-[10px] text-neutral-600">{[p.street, p.size_sqyd && `${p.size_sqyd} sq yd`, p.corner != null && (p.corner ? "corner plot" : "not a corner"), cap(p.status)].filter(Boolean).join(" · ")}</p></div>
          <p className="text-[10px] text-neutral-500">Generated {day(new Date().toISOString())}</p>
        </header>

        <div className="mt-3 grid grid-cols-4 gap-3">
          <Big k="Computed price" v={p.price ? money(p.price) : "-"} sub={p.price ? cap(p.quote_type) : "no quotes"} />
          <Big k="Per sq yd" v={ppsy(p) ? Math.round(ppsy(p)!).toLocaleString() : "-"} sub={C.vs_median != null ? `${C.vs_median > 0 ? "+" : ""}${Math.round(C.vs_median * 100)}% vs area median` : ""} />
          <Big k="Score" v={`${Math.round(S.score)} / 100`} sub={`${Math.round(S.coverage)}% verified`} />
          <Big k="Buildable" v={B.result?.total_covered_sqft != null ? `${Math.round(B.result.total_covered_sqft).toLocaleString()} sq ft` : "-"} sub={B.result?.total_covered_sqft != null ? `limited by ${B.result.binding}` : "no bylaw rule"} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
          <div className="grid content-start gap-4">
            <section><H>Price evidence</H>
              {P.quotes.length ? <table className="w-full"><tbody>{P.quotes.slice(0, 5).map((q: any) => <tr key={q.id}><td className="py-0.5">{q.broker}</td><td className="text-neutral-500">{cap(q.quote_type)}</td><td className="text-right">{money(q.price_pkr)}</td><td className="pl-2 text-right text-neutral-500">{day(q.created_at)}</td></tr>)}</tbody></table> : <p className="text-neutral-500">No quotes yet.</p>}
              {p.spread != null && p.spread >= cfg.spread_alert_pct / 100 && <p className="mt-1 text-[10px] text-red-700">Brokers differ by {Math.round(p.spread * 100)}%.</p>}
            </section>
            <section><H>Comparable plots</H>
              {C.comps.length ? <><table className="w-full"><tbody>{C.comps.slice(0, 4).map((c: any) => <tr key={c.id}><td className="py-0.5">{c.plot_label}</td><td className="text-neutral-500">{c.size_sqyd} sq yd</td><td className="text-right">{Math.round(c.ppsy).toLocaleString()}</td></tr>)}</tbody></table>
                <p className="mt-1 text-[10px] text-neutral-500">Median {Math.round(C.median).toLocaleString()} per sq yd across {C.n} similar plot{C.n === 1 ? "" : "s"}.</p></> : <p className="text-neutral-500">No similar priced plots in the area yet.</p>}
            </section>
            <section><H>Offers</H>
              {open.length ? open.map((n: any) => { const q = position(n); return <p key={n.id}>{n.counterparty}: {q.ours ? `we offered ${money(q.ours.amount_pkr)}` : "no offer from us"}{q.theirs ? `, they asked ${money(q.theirs.amount_pkr)}` : ""}.</p>; }) : <p className="text-neutral-500">No open negotiation.</p>}
            </section>
            <section><H>Location</H>
              {near.nearest?.length > 0 && <p className="text-neutral-600">{near.nearest.slice(0, 3).map((n: any) => `${cap(n.kind)} ${metres(n.meters)}`).join(" · ")}</p>}
            </section>
          </div>
          <div className="grid content-start gap-4">
            <section><H>Scorecard ({S.profile.name})</H>
              {sections.map((s: any) => <div key={s.key} className="mb-1"><div className="flex justify-between"><span>{s.label}</span><span className="text-neutral-500">{s.earned.toFixed(1)} / {s.weight}</span></div><div className="h-[3px] bg-neutral-200"><div className="h-[3px] bg-neutral-800" style={{ width: `${Math.min(100, s.pct)}%` }} /></div></div>)}
              {S.next_steps.slice(0, 3).map((n: any) => <p key={n.label} className="text-[10px] text-neutral-600">Next: {n.label} (+{n.gain})</p>)}
            </section>
            <section><H>Buildable area</H>
              {B.result?.total_covered_sqft != null ? <><p>Up to {Math.round(B.result.total_covered_sqft).toLocaleString()} sq ft covered. Rule: {B.rule.source}{B.rule.verified ? "" : " (not confirmed with the authority)"}.</p></> : <p className="text-neutral-500">No bylaw rule matches this plot.</p>}
            </section>
            {myTasks.length > 0 && <section><H>Open tasks</H>{myTasks.slice(0, 4).map((t: any) => <p key={t.id}>{t.title}{t.due_on && <span className="text-neutral-500"> · {day(t.due_on)}</span>}</p>)}</section>}
          </div>
        </div>
        <footer className="mt-5 border-t border-neutral-300 pt-2 text-[9px] text-neutral-500">
          This report summarises what is recorded in Bedrock on the date above. It is not legal advice and it does not decide that a plot is feasible. Prices, scores and areas are only as reliable as the evidence behind them ({Math.round(S.coverage)}% of this score is verified). Confirm title and bylaws with a lawyer and the authority before committing money.
        </footer>
      </div>
    </div>
  );
}
