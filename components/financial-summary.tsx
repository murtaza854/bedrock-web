"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { del, get, post } from "@/lib/api";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Entry, Model, Output, amt, pct } from "@/lib/feasibility";

const Line = ({ k, area = "", rate = "", v, strong }: { k: string; area?: string; rate?: string; v: string; strong?: boolean }) => (
  <tr className={`border-t border-line ${strong ? "font-medium" : "text-muted"}`}><td className="py-1.5 text-left">{k}</td><td className="py-1.5 text-right">{area}</td><td className="py-1.5 text-right">{rate}</td><td className={`py-1.5 text-right ${strong ? "" : "text-ink"}`}>{v}</td></tr>
);

// Several buildings are saved as one scenario with floors labelled "Building 2 – Ground".
const building = (label: string) => /^Building (\d+) – (.*)$/.exec(label);

function Table({ m, o }: { m: Model; o: Output }) {
  return (
    <table className="w-full text-xs">
      <thead><tr className="text-muted"><th className="py-1.5 text-left font-normal">Item</th><th className="py-1.5 text-right font-normal">Area (sq ft)</th><th className="py-1.5 text-right font-normal">Rate per sq ft</th><th className="py-1.5 text-right font-normal">Amount (PKR)</th></tr></thead>
      <tbody>
        {o.floors.map((f) => { const rate = m.floors.find((x) => x.label === f.label)?.price_per_sqft; return <Line key={f.label} k={f.label} area={amt(f.built_sqft)} rate={rate ? amt(rate) : "-"} v={f.revenue ? amt(f.revenue) : "-"} />; })}
        <Line k="Revenue" v={amt(o.revenue)} strong />
        <Line k="Construction" area={amt(o.built_area_sqft)} rate={amt(m.construction_per_sqft)} v={amt(o.construction)} />
        <Line k="Land" v={amt(o.land)} />
        <Line k="Total cost" v={amt(o.total_cost)} strong />
        <Line k="Profit" v={amt(o.profit)} strong />
        {m.construction_months > 0 && <>
          <Line k="Construction time" area={`${m.construction_months} months`} v="" />
          <Line k="Monthly profit" v={amt(Math.round(o.profit / m.construction_months))} />
          <Line k="Annual profit" v={amt(Math.round((o.profit / m.construction_months) * 12))} />
        </>}
      </tbody>
    </table>
  );
}

// Edit, make primary (the one the list and the scorecard use), or delete: asks first.
function Actions({ m, plotId, edit, onChange }: { m: Model; plotId: string; edit: boolean; onChange: () => void }) {
  const [asking, setAsking] = useState(false);
  const btn = "rounded-lg bg-line/50 px-3.5 py-2 text-xs font-medium hover:bg-line";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {edit && <Link href={`/dashboard/plots/${plotId}/feasibility?scenario=${m.id}`} className={btn}>Edit this scenario</Link>}
      {!m.is_primary && <button type="button" onClick={() => post(`/financial-models/${m.id}/primary`, {}).then(onChange)} className={btn}>Make primary</button>}
      <button type="button" onClick={() => setAsking(true)} className={btn}>Delete</button>
      <ConfirmDialog open={asking} title={`Delete ${m.name}?`} text="This removes the scenario and its numbers. It cannot be undone." confirm="Delete scenario"
        onClose={() => setAsking(false)} onConfirm={() => del(`/financial-models/${m.id}`).then(onChange)} />
    </div>
  );
}

// One scenario. With several buildings there are three views: each building on its own, and the two combined.
// A building on its own gets its share of the land (the land split equally), worked out by the same calculation.
function Scenario({ m, o, plotId, onChange }: { m: Model; o: Output; plotId: string; onChange: () => void }) {
  const nums = [...new Set(m.floors.map((f) => building(f.label)?.[1]).filter(Boolean))] as string[];
  const [view, setView] = useState("all");
  const [part, setPart] = useState<{ view: string; m: Model; o: Output } | null>(null);
  useEffect(() => {
    if (view === "all") return;
    const dm = { ...m, plot_area_sqyd: m.plot_area_sqyd / nums.length, land_price: Math.round(m.land_price / nums.length), land_price_basis: "manual",
      floors: m.floors.filter((f) => building(f.label)?.[1] === view).map((f) => ({ ...f, label: building(f.label)![2] })) };
    post("/financial/compute", dm).then((r) => setPart({ view, m: dm, o: r.output })).catch(() => {});
  }, [view]);
  const shown = view === "all" ? { m, o } : part?.view === view ? part : null;
  return (
    <div className="mt-3">
      {nums.length > 1 && (
        <div className="mb-3 flex gap-2 text-xs">
          {[...nums.map((k) => [k, `Building ${k}`]), ["all", "Combined"]].map(([k, text]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}
              className={`rounded-lg px-3 py-1.5 ${view === k ? "bg-ink text-bg" : "bg-line/50 hover:bg-line"}`}>{text}</button>))}
        </div>)}
      {shown && <Table m={shown.m} o={shown.o} />}
      <Actions m={m} plotId={plotId} edit onChange={onChange} />
    </div>
  );
}

export function FinancialSummary({ plotId, bought }: { plotId: string; bought: boolean }) {
  const [list, setList] = useState<Entry[] | null>(null);
  const load = () => get(`/plots/${plotId}/financial-models`).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, [plotId]);
  if (!list) return null;
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Feasibility<span className="ml-3 normal-case tracking-normal">{list.length} {list.length === 1 ? "scenario" : "scenarios"}</span></h2>
        <span className="flex gap-5 text-sm"><Link href={`/dashboard/plots/${plotId}/feasibility`} className="text-muted hover:text-ink">Quick feasibility</Link>{bought && <Link href={`/dashboard/plots/${plotId}/financials`} className="text-muted hover:text-ink">Detailed</Link>}</span>
      </div>
      {list.length ? (
        <ul className="mt-4 text-sm">{list.map(({ model: m, output: o, errors }) => (
          <li key={m.id} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
            <details>
              <summary className="flex cursor-pointer items-center justify-between gap-4">
                <span className="font-medium">{m.name}{m.is_primary && <span className="ml-2 text-xs font-normal text-muted">primary</span>}</span>
                <span className="text-muted">{errors?.length || !o ? "Incomplete" : `Profit ${amt(o.profit)} · ${pct(o.margin_on_cost)} on cost`}</span>
              </summary>
              {errors?.length || !o ? (
                <>
                  <ul className="mt-3 grid gap-1 text-xs text-muted">{(errors ?? []).map((e) => <li key={e.field + e.message}>{e.message}</li>)}</ul>
                  <Actions m={m} plotId={plotId} edit={false} onChange={load} />
                </>
              ) : <Scenario m={m} o={o} plotId={plotId} onChange={load} />}
            </details>
          </li>))}</ul>
      ) : <p className="mt-4 text-sm text-muted">No model yet. Work out what this plot can pay for the land.</p>}
    </section>
  );
}
