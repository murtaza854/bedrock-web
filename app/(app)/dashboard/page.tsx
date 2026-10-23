"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { Select } from "@/components/ui/select";
import { useSettings } from "@/lib/settings";

const fmt = (n: number) => Math.round(n).toLocaleString();
const pct = (v: number, plus = true) => `${plus && v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
const LEVELS = [
  { key: "claimed", label: "Claimed", bar: "bg-muted/40" },
  { key: "ai_unverified", label: "AI, unverified", bar: "bg-amber-400" },
  { key: "site_verified", label: "Site verified", bar: "bg-violet-400" },
  { key: "document_verified", label: "Document verified", bar: "bg-sky-400" },
  { key: "authority_confirmed", label: "Authority confirmed", bar: "bg-accent" },
];

function Section({ title, note, className = "", children }: { title: string; note?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`border-t border-line pt-5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h2>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 text-3xl font-light tracking-tight">{value}</p>
      <p className="mt-1 min-h-4 text-xs text-muted">{sub}</p>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-sm text-muted">{empty}</p>;
  const al = (i: number) => (i === 0 ? "text-left" : "text-right");
  return (
    <table className="w-full text-sm">
      <thead><tr>{head.map((h, i) => <th key={h} className={`pb-2 text-xs font-normal text-muted ${al(i)}`}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className={`py-2.5 ${al(j)} ${j === 0 ? "font-medium" : ""}`}>{c}</td>)}</tr>
      ))}</tbody>
    </table>
  );
}

const Dim = ({ children }: { children: React.ReactNode }) => <span className="text-muted">{children}</span>;
const Tone = ({ v }: { v: number }) => <span className={Math.abs(v) < 0.05 ? "text-muted" : v > 0 ? "text-red-500" : "text-accent"}>{pct(v)}</span>;
const med = (o: any, min: number) => (o && o.n >= min ? fmt(o.median) : null);

function Weekly({ rows }: { rows: any[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n)), total = rows.reduce((s, r) => s + r.n, 0);
  return (
    <>
      <div className="flex h-16 items-end gap-1.5">
        {rows.map((r) => (
          <div key={r.week} title={`Week of ${r.week}: ${r.n} quotes`} className="flex-1 rounded-sm bg-ink/80"
            style={{ height: `${Math.max(r.n ? (r.n / max) * 100 : 0, 3)}%`, opacity: r.n ? 1 : 0.15 }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted"><span>12 weeks ago</span><span>{total} quotes</span><span>this week</span></div>
    </>
  );
}

function Meter({ label, n, of }: { label: string; n: number; of: number }) {
  const p = of ? n / of : 0;
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><Dim>{n}/{of} · {pct(p, false)}</Dim></div>
      <div className="mt-1.5 h-1 rounded-full bg-line"><div className="h-1 rounded-full bg-ink/70" style={{ width: `${p * 100}%` }} /></div>
    </div>
  );
}

const STATUS_OPTS = [
  { value: "all", label: "All plots" }, { value: "active", label: "Active (not rejected)" }, { value: "new", label: "New" }, { value: "shortlisted", label: "Shortlisted" },
  { value: "negotiating", label: "Negotiating" }, { value: "bought", label: "Bought" }, { value: "rejected", label: "Rejected" },
];
const PERIOD_OPTS = [{ value: "0", label: "Quotes from any time" }, { value: "30", label: "Quotes from the last 30 days" }, { value: "90", label: "Quotes from the last 90 days" }, { value: "365", label: "Quotes from the last year" }];

export default function Overview() {
  const { min_sample: MIN_N, spread_alert_pct } = useSettings();
  const [s, setS] = useState<any>(null);
  const [err, setErr] = useState("");
  const [areaChoices, setAreaChoices] = useState<string[]>([]);
  const [area, setArea] = useState("all");
  const [status, setStatus] = useState("all");
  const [days, setDays] = useState("0");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  // the filters live in the address (?area=&status=&days=), so a filtered view can be bookmarked or shared
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setArea(q.get("area") ?? "all"); setStatus(q.get("status") ?? "all"); setDays(q.get("days") ?? "0"); setReady(true);
    get("/plots").then((p) => setAreaChoices([...new Set<string>(p.map((x: any) => x.area))].sort()));
  }, []);
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams();
    if (area !== "all") q.set("area", area);
    if (status !== "all") q.set("status", status);
    if (days !== "0") q.set("days", days);
    history.replaceState(null, "", q.toString() ? `?${q}` : location.pathname);
    setBusy(true);
    get(`/stats${q.toString() ? `?${q}` : ""}`).then((r) => { setS(r); setErr(""); }).catch((e) => setErr(e.message)).finally(() => setBusy(false));
  }, [ready, area, status, days]);
  const filtered = area !== "all" || status !== "all" || days !== "0";
  const clear = () => { setArea("all"); setStatus("all"); setDays("0"); };
  if (err) return <p className="text-sm text-red-500">Could not load analytics: {err}. Is the API up to date (make run)?</p>;
  if (!s) return null;

  const o = (k: string) => s.overall.find((x: any) => x.kind === k);
  const ask = o("asking"), conf = o("confirmed");
  const gap = ask?.n >= MIN_N && conf?.n >= MIN_N ? 1 - conf.median / ask.median : null;
  const areas = [...new Set<string>(s.area_plots.map((p: any) => p.area))].sort();
  const pp = (ar: string) => s.area_plots.find((p: any) => p.area === ar)?.n ?? 0;
  const bp = (ar: string, k: string) => s.by_area.find((r: any) => r.area === ar && r.kind === k);
  const total = s.verification.reduce((a: number, r: any) => a + r.n, 0);
  const q = s.quality;
  const below = s.vs_area.slice(0, 4), above = [...s.vs_area].reverse().slice(0, 4).filter((r: any) => r.diff > 0);

  return (
    <div className={`grid gap-10 transition-opacity ${busy ? "opacity-60" : ""}`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
          <Select label="Area" variant="ghost" className="-ml-2" value={area} onChange={setArea} options={[{ value: "all", label: "All areas" }, ...areaChoices.map((a) => ({ value: a, label: a }))]} />
          <Select label="Status" variant="ghost" value={status} onChange={setStatus} options={STATUS_OPTS} />
          <Select label="Quotes from" variant="ghost" value={days} onChange={setDays} options={PERIOD_OPTS} />
          {filtered && <button onClick={clear} className="ml-2 text-xs text-muted underline hover:text-ink">Clear filters</button>}
          <span className="ml-auto text-xs text-muted">{s.totals.plots} {s.totals.plots === 1 ? "plot" : "plots"}{filtered && " match"}</span>
        </div>
      </div>

      {s.totals.plots === 0 ? (
        <p className="border-t border-line pt-5 text-sm text-muted">{filtered ? "No plots match these filters." : "No plots yet."} {filtered && <button onClick={clear} className="underline hover:text-ink">Clear the filters</button>}</p>
      ) : (<>

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Plots" value={s.totals.plots} />
        <Kpi label="Median asking / sq yd" value={med(ask, MIN_N) ?? "-"} sub={`n=${ask?.n ?? 0}${med(ask, MIN_N) ? "" : ", not enough data"}`} />
        <Kpi label="Median confirmed / sq yd" value={med(conf, MIN_N) ?? "-"} sub={`n=${conf?.n ?? 0}${med(conf, MIN_N) ? "" : ", not enough data"}`} />
        <Kpi label="Asking to confirmed" value={gap == null ? "-" : pct(-gap)} sub={gap == null ? "needs 3+ of each" : "typical discount"} />
        <Kpi label="Quotes this week" value={s.totals.quotes_week} />
        <Kpi label="Brokers disagree" value={s.totals.spread_wide} sub={`plots with ${spread_alert_pct}%+ spread`} />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Quote activity" note="per week"><Weekly rows={s.weekly} /></Section>
        <Section title="Data quality" note={`${q.plots} plots`}>
          <div className="grid gap-3.5">
            <Meter label="Has size" n={q.with_size} of={q.plots} />
            <Meter label="Has a quote" n={q.quoted} of={q.plots} />
            <Meter label="Two or more brokers" n={q.multi_broker} of={q.plots} />
            <Meter label="Has a verified claim" n={q.verified} of={q.plots} />
            <Meter label="Has GPS" n={q.with_gps} of={q.plots} />
          </div>
        </Section>
      </div>

      <Section title="Areas" note="PKR per sq yd">
        <Table empty="No plots yet." head={["Area", "Plots", "Asking", "Confirmed", "Gap"]}
          rows={areas.map((ar) => {
            const a = bp(ar, "asking"), c = bp(ar, "confirmed");
            const g = a?.n >= MIN_N && c?.n >= MIN_N ? c.median / a.median - 1 : null;
            return [ar, pp(ar),
              a ? <>{fmt(a.median)} <Dim>n={a.n}</Dim></> : <Dim>-</Dim>,
              c ? <>{fmt(c.median)} <Dim>n={c.n}</Dim></> : <Dim>-</Dim>,
              g == null ? <Dim>-</Dim> : pct(g)];
          })} />
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Price by plot size" note="median PKR per sq yd">
          <Table empty="No sized plots yet." head={["Sq yd", "Plots", "Quotes", "Median"]}
            rows={s.sizes.map((r: any) => [r.band, r.plots, r.quotes, r.quotes >= MIN_N ? fmt(r.median) : <Dim>not enough data</Dim>])} />
        </Section>
        <Section title="Brokers" note="price against other brokers on the same plots">
          <Table empty="No quotes yet." head={["Broker", "Quotes", "Plots", "Vs peers"]}
            rows={s.brokers.map((r: any) => [r.broker, r.n, r.plots, r.avg_dev == null ? <Dim>no overlap</Dim> : <Tone v={r.avg_dev} />])} />
        </Section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Priced against their area" note="plot vs area median">
          {s.vs_area.length ? (
            <Table empty="" head={["Plot", "PKR / sq yd", "Vs area"]}
              rows={[...below, ...above.filter((a: any) => !below.some((b: any) => b.plot_id === a.plot_id))].map((r: any) => [
                <Link key={r.plot_id} href={`/dashboard/plots/${r.plot_id}`}>{r.label}</Link>, fmt(r.ppsy), <Tone key="t" v={r.diff} />])} />
          ) : <p className="py-6 text-sm text-muted">Needs an area with {MIN_N}+ priced plots.</p>}
        </Section>
        <Section title="Verification mix" note={`${total} claims`}>
          {total ? (
            <>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-line">
                {LEVELS.map((l) => { const n = s.verification.find((r: any) => r.verification === l.key)?.n ?? 0; return n ? <div key={l.key} className={l.bar} style={{ width: `${(n / total) * 100}%` }} /> : null; })}
              </div>
              <ul className="mt-4 grid gap-2 text-sm">
                {LEVELS.map((l) => { const n = s.verification.find((r: any) => r.verification === l.key)?.n ?? 0; return (
                  <li key={l.key} className="flex justify-between"><span className="flex items-center gap-2"><i className={`size-2 rounded-full ${l.bar}`} />{l.label}</span><Dim>{n}</Dim></li>); })}
              </ul>
            </>
          ) : <p className="py-6 text-sm text-muted">No claims yet.</p>}
        </Section>
      </div>

      <Section title="Needs attention" note={`${s.attention.length}`}>
        <ul className="text-sm">
          {s.attention.map((a: any, i: number) => (
            <li key={i} className="flex items-center justify-between border-t border-line py-2.5 first:border-t-0 first:pt-0">
              <Link href={`/dashboard/plots/${a.plot_id}`} className="font-medium">{a.label}</Link><Dim>{a.reason}</Dim>
            </li>
          ))}
          {!s.attention.length && <li className="text-muted">Nothing needs attention.</li>}
        </ul>
      </Section>
      </>)}
    </div>
  );
}
