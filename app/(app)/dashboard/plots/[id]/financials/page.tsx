"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { del, get, post, put } from "@/lib/api";
import { cap, label } from "@/lib/plots";
import { Badge, levelTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  BASES, COVERS, CostRow, Entry, FLOOR_TYPES, FieldError, LAND_BASES, LEVELS, Model, Output, PCT_BASES, SQFT_PER_SQYD, USES,
  apiErrors, blankFloor, crore, exact, pct,
} from "@/lib/feasibility";

const opts = (xs: string[]) => xs.map((v) => ({ value: v, label: cap(v) }));
const day = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Section({ title, note, action, children }: { title: string; note?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}{note && <span className="ml-3 normal-case tracking-normal">{note}</span>}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
const Money = ({ n }: { n: number }) => <span title={exact(n)}>{crore(n)}</span>;
const Stat = ({ k, v, sub, tone }: { k: string; v: React.ReactNode; sub?: React.ReactNode; tone?: string }) => (
  <div><p className="text-xs text-muted">{k}</p><p className={`mt-1.5 text-2xl font-light tracking-tight ${tone ?? ""}`}>{v}</p>{sub && <p className="mt-1 text-xs text-muted">{sub}</p>}</div>
);
const Lvl = ({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) => (
  <Select label={`${name} verification`} variant="ghost" value={value} onChange={onChange} options={LEVELS.map((l) => ({ value: l, label: cap(l) }))} />
);
const Num = ({ v, set, className = "", ...p }: { v: number; set: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value">) => (
  <Input type="number" min={0} step="any" className={className} value={Number.isFinite(v) ? v : ""} onChange={(e) => set(e.target.valueAsNumber)} {...p} />
);

export default function Financials({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plot, setPlot] = useState<any>(null);
  const [list, setList] = useState<Entry[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [draft, setDraft] = useState<Model | null>(null);
  const [dirty, setDirty] = useState(false);
  const [res, setRes] = useState<{ output: Output | null; errors: FieldError[]; land: number }>({ output: null, errors: [], land: 0 });
  const [ctx, setCtx] = useState<any>(null);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [gen, setGen] = useState({ count: 5, price: 0 });
  const [other, setOther] = useState<number | null>(null);
  const tick = useRef(0);

  const loadSnaps = () => get(`/plots/${id}/financial-snapshots`).then(setSnaps).catch(() => {});
  const reload = useCallback(async (pick?: number) => {
    const l: Entry[] = await get(`/plots/${id}/financial-models`);
    setList(l);
    const target = l.find((e) => e.model.id === (pick ?? sel))?.model ?? l[0]?.model ?? null;
    setSel(target?.id ?? null);
    setDraft(target ? structuredClone(target) : null);
    setDirty(false);
  }, [id, sel]);
  useEffect(() => {
    get(`/plots/${id}`).then((d) => setPlot(d.plot));
    get(`/plots/${id}/financial-context`).then(setCtx);
    reload().catch((e) => setMsg(e.message));
    loadSnaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // the dry run: every edit is re-computed by the server, so the screen never does its own arithmetic
  useEffect(() => {
    if (!draft) return;
    const n = ++tick.current;
    const t = setTimeout(async () => {
      try {
        const r = await post("/financial/compute", draft);
        if (n === tick.current) setRes({ output: r.errors?.length ? null : r.output, errors: r.errors ?? [], land: r.land_price });
      } catch (e) { if (n === tick.current) setMsg((e as Error).message); }
    }, 250);
    return () => clearTimeout(t);
  }, [draft]);

  const edit = (f: (m: Model) => void) => setDraft((d) => { if (!d) return d; const m = structuredClone(d); f(m); return m; }), mark = (f: (m: Model) => void) => { edit(f); setDirty(true); };
  const err = (f: string) => res.errors.find((e) => e.field === f)?.message;
  const E = ({ f }: { f: string }) => (err(f) ? <p role="alert" className="mt-1 text-xs text-red-500">{err(f)}</p> : null);
  const o = res.output;
  const run = async (fn: () => Promise<any>, ok?: string) => { setMsg(""); try { const r = await fn(); if (ok) setMsg(ok); return r; } catch (e) { setMsg(apiErrors(e).map((x) => x.message).join(" ")); } };

  const save = async () => {
    if (!draft) return;
    setMsg("");
    try { await put(`/financial-models/${draft.id}`, draft); await reload(draft.id); setMsg("Saved."); }
    catch (e) { setRes((r) => ({ ...r, errors: apiErrors(e) })); setMsg("Fix the highlighted fields to save."); }
  };
  const create = async () => {
    const m = await run(() => post(`/plots/${id}/financial-models`, { name: newName, scenario_label: newName.toLowerCase() }));
    if (m) { setNewName(""); await reload(m.id); }
  };

  if (!list || !plot) return null;
  const area = plot.size_sqyd;
  const focus = list.find((e) => e.model.id === other);
  const cmp: [string, (x: Output) => React.ReactNode][] = [
    ["Revenue", (x) => <Money n={x.revenue} />], ["Total cost", (x) => <Money n={x.total_cost} />], ["Profit", (x) => <Money n={x.profit} />],
    ["Margin on cost", (x) => pct(x.margin_on_cost)], ["Break-even land", (x) => <Money n={x.break_even_land} />], ["Residual land", (x) => <Money n={x.residual_land} />],
  ];

  return (
    <>
      <Link href={`/dashboard/plots/${id}`} className="text-sm text-muted hover:text-ink">← {label(plot)}</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financial feasibility</h1>
          <p className="mt-1 text-sm text-muted">{area ? `${area} sq yd = ${(area * SQFT_PER_SQYD).toLocaleString()} sq ft` : "This plot has no size yet."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {list.map(({ model: m }) => (
            <button key={m.id} onClick={() => reload(m.id)} aria-pressed={m.id === sel}
              className={`rounded-md px-3 py-1.5 text-sm ${m.id === sel ? "bg-line text-ink" : "text-muted hover:text-ink"}`}>{m.name}{m.is_primary && " ★"}</button>
          ))}
          <Input className="w-36" placeholder="New scenario" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newName.trim() && create()} />
          <Button variant="ghost" disabled={!newName.trim() || !area} onClick={create}>Add</Button>
        </div>
      </div>
      {msg && <p role="status" className="mt-3 text-sm text-muted">{msg}</p>}

      {!draft ? <p className="mt-12 text-center text-sm text-muted">{area ? "No scenario yet. Name one above, for example Demand or Try." : "Set the plot size first, then add a scenario."}</p> : (
        <div className="mt-6 grid gap-8">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Input className="w-56" aria-label="Scenario name" value={draft.name} onChange={(e) => mark((m) => { m.name = e.target.value; })} />
            <Button disabled={!dirty} onClick={save}>{dirty ? "Save changes" : "Saved"}</Button>
            {!draft.is_primary && <Button variant="ghost" disabled={dirty} onClick={async () => { await run(() => post(`/financial-models/${draft.id}/primary`, {})); reload(draft.id); }}>Make primary</Button>}
            <Button variant="ghost" disabled={dirty} onClick={async () => { const m = await run(() => post(`/financial-models/${draft.id}/duplicate`, { name: `${draft.name} (copy)`, scenario_label: "" })); if (m) reload(m.id); }}>Duplicate</Button>
            <button className="text-muted hover:text-red-500" onClick={async () => { if (confirm(`Delete ${draft.name}? Saved snapshots stay.`)) { await run(() => del(`/financial-models/${draft.id}`)); setSel(null); reload(); } }}>Delete</button>
            {draft.is_primary && <span className="text-xs text-muted">Primary: the scorecard reads this one.</span>}
          </div>

          {/* warnings and confidence first, so they are seen without scrolling */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Warnings</p>
              {res.errors.length > 0 && <ul className="mt-3 grid gap-1.5 text-sm text-red-500">{res.errors.map((e, i) => <li key={i}>{e.message}{e.field && <span className="text-xs opacity-70"> ({e.field})</span>}</li>)}</ul>}
              {o ? (o.warnings.length ? <ul className="mt-3 grid gap-1.5 text-sm">{o.warnings.map((w) => <li key={w.code} className="flex gap-2"><Badge tone="warn">!</Badge><span>{w.message}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted">None.</p>) : null}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Confidence</p>
              {o && <>
                <p className="mt-3 text-sm">{o.confidence.label}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{o.confidence.items.map((c, i) => <span key={i} title={c.name}><Badge tone={levelTone[c.level]}>{c.name}: {cap(c.level)}</Badge></span>)}</div>
              </>}
            </div>
          </div>

          <Section title="Result" note={`target margin ${pct(draft.target_margin, 0)} on cost`}>
            {o ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                <Stat k="Revenue" v={<Money n={o.revenue} />} sub={`${o.sellable_area_sqft.toLocaleString()} of ${o.built_area_sqft.toLocaleString()} sq ft sellable`} />
                <Stat k="Total cost" v={<Money n={o.total_cost} />} sub={<>Land <Money n={o.land} /> · build <Money n={o.construction} /> · other <Money n={o.other_costs} /></>} />
                <Stat k="Profit" v={<Money n={o.profit} />} tone={o.profit < 0 ? "text-red-500" : ""} sub={`${pct(o.margin_on_cost)} on cost · ${pct(o.margin_on_revenue)} on revenue`} />
                <Stat k="Land share of cost" v={pct(o.land_share, 1)} sub={`${o.land_per_sqyd.toLocaleString()} per sq yd`} />
                <Stat k="Break-even land price" v={<Money n={o.break_even_land} />} sub="profit is zero" />
                <Stat k="Residual land price" v={<Money n={o.residual_land} />} sub={`reaches ${pct(draft.target_margin, 0)} margin`} />
                <Stat k="Land price used" v={<Money n={o.land} />} tone={o.asking_gap > 0 ? "text-red-500" : ""}
                  sub={o.residual_land > 0 ? (o.asking_gap > 0 ? <><Money n={o.asking_gap} /> above the residual ({pct((o.asking_vs_residual ?? 1) - 1, 1)})</> : <><Money n={-o.asking_gap} /> below the residual</>) : "no land price reaches the target"} />
              </div>
            ) : <p className="text-sm text-muted">Fix the fields marked in red to see results.</p>}
          </Section>

          <Section title="Land price" note={res.land ? `using ${exact(res.land)}` : undefined}>
            <div className="grid gap-4 sm:grid-cols-4">
              <div><p className="mb-1.5 text-xs text-muted">Basis</p>
                <Select label="Land price basis" value={draft.land_price_basis} onChange={(v) => mark((m) => { m.land_price_basis = v; })} options={LAND_BASES.map((b) => ({ value: b, label: b === "manual" ? "Manual" : b === "specific" ? "A specific quote" : `${cap(b)} quote` }))} /></div>
              {draft.land_price_basis === "specific" && (
                <div><p className="mb-1.5 text-xs text-muted">Quote</p>
                  <Select label="Quote" value={String(draft.land_quote_id ?? "")} onChange={(v) => mark((m) => { m.land_quote_id = Number(v); })}
                    options={(ctx?.quotes ?? []).map((q: any) => ({ value: String(q.id), label: `${q.broker}: ${crore(q.price_pkr)} (${cap(q.quote_type)})` }))} /></div>)}
              {draft.land_price_basis === "manual" && (
                <div><p className="mb-1.5 text-xs text-muted">Total land price (PKR)</p><Num v={draft.land_price} set={(n) => mark((m) => { m.land_price = n; })} /><E f="land_price" /></div>)}
              <div><p className="mb-1.5 text-xs text-muted">Source</p><Input value={draft.land_source} placeholder="Who said so" onChange={(e) => mark((m) => { m.land_source = e.target.value; })} /></div>
              <div><p className="mb-1.5 text-xs text-muted">Verification</p><Lvl name="Land price" value={draft.land_verification} onChange={(v) => mark((m) => { m.land_verification = v as any; })} /></div>
            </div>
            {draft.land_price_basis !== "manual" && <E f="land_price" />}
            {ctx?.summary && Object.keys(ctx.summary).length > 0
              ? <p className="mt-3 text-xs text-muted">Quotes on this plot: {(["lowest", "median", "latest"] as const).filter((k) => ctx.summary[k]).map((k) => <button key={k} className="mr-3 underline-offset-2 hover:text-ink hover:underline" onClick={() => mark((m) => { m.land_price_basis = k; })}>{cap(k)} <Money n={ctx.summary[k]} /></button>)}</p>
              : <p className="mt-3 text-xs text-muted">No quotes on this plot yet. Enter the land price by hand.</p>}
          </Section>

          <Section title="Floors" note={`${draft.floors.length} floors · ${o ? o.built_area_sqft.toLocaleString() : "-"} sq ft built`}
            action={<span className="flex flex-wrap items-center gap-2 text-sm">
              <Num className="w-16" aria-label="How many upper floors" v={gen.count} set={(n) => setGen({ ...gen, count: n })} />
              <Num className="w-28" aria-label="Price per sq ft for the generated floors" placeholder="PKR / sq ft" v={gen.price} set={(n) => setGen({ ...gen, price: n })} />
              <button className="text-muted hover:text-ink" onClick={async () => {
                const ground = draft.floors.find((f) => f.floor_type === "ground");
                const foot = ground?.built_area_sqft || (area ? area * SQFT_PER_SQYD : 0);
                const first = draft.floors.filter((f) => f.floor_type === "upper").length + 1;
                const fl = await run(() => post("/financial/generate-floors", { count: gen.count, first, footprint_sqft: foot, price_per_sqft: gen.price, use: "office" }));
                if (fl) mark((m) => { m.floors.push(...fl); });
              }}>+ Generate upper floors</button>
              <button className="text-muted hover:text-ink" onClick={() => mark((m) => { m.floors.push({ ...blankFloor(), label: m.floors.length ? "" : "Ground", floor_type: m.floors.length ? "upper" : "ground" }); })}>+ Add floor</button>
            </span>}>
            <E f="floors" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead><tr className="text-left text-xs font-normal text-muted">
                  {["Label", "Type", "Use", "Built sq ft", "Sellable share", "Price mode", "Price", "Basis", "Verification", ""].map((h) => <th key={h} className="pb-2 pr-3 font-normal">{h}</th>)}
                </tr></thead>
                <tbody>{draft.floors.map((f, i) => {
                  const set = (g: (x: typeof f) => void) => mark((m) => g(m.floors[i]));
                  const fe = (k: string) => err(`floors[${i}].${k}`);
                  return (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="py-2 pr-3"><Input className="w-28" aria-label={`Floor ${i + 1} label`} aria-invalid={!!fe("label")} value={f.label} onChange={(e) => set((x) => { x.label = e.target.value; })} /></td>
                      <td className="py-2 pr-3"><Select label="Floor type" value={f.floor_type} onChange={(v) => set((x) => { x.floor_type = v; })} options={opts(FLOOR_TYPES)} /></td>
                      <td className="py-2 pr-3"><Select label="Use" value={f.use} onChange={(v) => set((x) => { x.use = v; })} options={opts(USES)} /></td>
                      <td className="py-2 pr-3"><Num className="w-28" aria-label="Built area" aria-invalid={!!fe("built_area_sqft")} v={f.built_area_sqft} set={(n) => set((x) => { x.built_area_sqft = n; })} />{fe("built_area_sqft") && <p role="alert" className="mt-1 text-xs text-red-500">{fe("built_area_sqft")}</p>}</td>
                      <td className="py-2 pr-3"><Num className="w-20" aria-label="Sellable share" step="0.01" max={1} aria-invalid={!!fe("sellable_ratio")} v={f.sellable_ratio} set={(n) => set((x) => { x.sellable_ratio = n; })} />
                        <Lvl name="Sellable share" value={f.ratio_verification} onChange={(v) => set((x) => { x.ratio_verification = v as any; })} />{fe("sellable_ratio") && <p role="alert" className="mt-1 text-xs text-red-500">{fe("sellable_ratio")}</p>}</td>
                      <td className="py-2 pr-3"><Select label="Price mode" value={f.price_mode} onChange={(v) => set((x) => { x.price_mode = v as any; })} options={[{ value: "per_sqft", label: "Per sellable sq ft" }, { value: "fixed_total", label: "Fixed per unit" }]} /></td>
                      <td className="py-2 pr-3">{f.price_mode === "per_sqft"
                        ? <><Num className="w-28" aria-label="Price per sq ft" aria-invalid={!!fe("price_per_sqft")} v={f.price_per_sqft} set={(n) => set((x) => { x.price_per_sqft = n; })} /><p className="mt-1 text-xs text-muted">PKR / sq ft</p>{fe("price_per_sqft") && <p role="alert" className="text-xs text-red-500">{fe("price_per_sqft")}</p>}</>
                        : <div className="flex gap-2"><div><Num className="w-36" aria-label="Price per unit" v={f.fixed_unit_price} set={(n) => set((x) => { x.fixed_unit_price = n; })} /><p className="mt-1 text-xs text-muted">PKR / unit</p></div><div><Num className="w-16" aria-label="Units" step="1" v={f.unit_count} set={(n) => set((x) => { x.unit_count = n; })} /><p className="mt-1 text-xs text-muted">units</p></div></div>}
                        {(fe("fixed_unit_price") || fe("unit_count")) && <p role="alert" className="text-xs text-red-500">{fe("fixed_unit_price") || fe("unit_count")}</p>}</td>
                      <td className="py-2 pr-3"><label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={f.price_basis_confirmed} onChange={(e) => set((x) => { x.price_basis_confirmed = e.target.checked; })} />{f.price_mode === "per_sqft" ? "Per sellable sq ft confirmed" : "Unit price confirmed"}</label></td>
                      <td className="py-2 pr-3"><Lvl name="Price" value={f.price_verification} onChange={(v) => set((x) => { x.price_verification = v as any; })} /></td>
                      <td className="py-2 text-right"><button aria-label={`Remove floor ${i + 1}`} className="text-muted hover:text-red-500" onClick={() => mark((m) => { m.floors.splice(i, 1); })}>×</button></td>
                    </tr>);
                })}</tbody>
              </table>
            </div>
            {o && <p className="mt-3 text-xs text-muted">Revenue by floor: {o.floors.map((f) => <span key={f.label} className="mr-3">{f.label} <Money n={f.revenue} /></span>)}</p>}
          </Section>

          <Section title="Construction cost">
            <div className="grid gap-4 sm:grid-cols-4">
              <div><p className="mb-1.5 text-xs text-muted">PKR per built sq ft (all floors)</p><Num v={draft.construction_per_sqft} set={(n) => mark((m) => { m.construction_per_sqft = n; })} /><E f="construction_per_sqft" /></div>
              <div><p className="mb-1.5 text-xs text-muted">What it covers</p><Select label="What the construction rate covers" value={draft.construction_covers} onChange={(v) => mark((m) => { m.construction_covers = v; })} options={opts(COVERS)} /></div>
              <div><p className="mb-1.5 text-xs text-muted">Verification</p><Lvl name="Construction" value={draft.construction_verification} onChange={(v) => mark((m) => { m.construction_verification = v as any; })} /></div>
              <div><p className="mb-1.5 text-xs text-muted">Note</p><Input value={draft.construction_note} onChange={(e) => mark((m) => { m.construction_note = e.target.value; })} /></div>
            </div>
          </Section>

          <Section title="Other costs" note="blank until you enter a rate; none are assumed"
            action={<span className="flex items-center gap-3 text-sm">
              {ctx?.rates?.length > 0 && <Select label="Add from rate table" variant="ghost" value="" onChange={(k) => {
                const r = ctx.rates.find((x: any) => x.key === k); if (!r) return;
                mark((m) => { m.costs.push(r.kind === "percent" ? { label: r.label, basis: r.side === "sell" ? "pct_of_revenue" : "pct_of_land", amount: 0, rate: r.value / 100, verification: "claimed", note: "From the rate table" } : { label: r.label, basis: "fixed", amount: r.value, rate: 0, verification: "claimed", note: "From the rate table" }); });
              }} options={[{ value: "", label: "+ From rate table" }, ...ctx.rates.map((r: any) => ({ value: r.key, label: r.label }))]} />}
              <button className="text-muted hover:text-ink" onClick={() => mark((m) => { m.costs.push({ label: "", basis: "fixed", amount: 0, rate: 0, verification: "claimed", note: "" }); })}>+ Add row</button>
            </span>}>
            <div className="grid gap-2">{draft.costs.map((c, i) => {
              const set = (g: (x: CostRow) => void) => mark((m) => g(m.costs[i]));
              const isPct = PCT_BASES.includes(c.basis);
              const ce = (k: string) => err(`costs[${i}].${k}`);
              return (
                <div key={i} className="flex flex-wrap items-start gap-2">
                  <div><Input className="w-52" aria-label={`Cost ${i + 1} label`} aria-invalid={!!ce("label")} value={c.label} onChange={(e) => set((x) => { x.label = e.target.value; })} />{ce("label") && <p role="alert" className="mt-1 text-xs text-red-500">{ce("label")}</p>}</div>
                  <Select label="Cost basis" value={c.basis} onChange={(v) => set((x) => { x.basis = v; if (PCT_BASES.includes(v)) x.amount = 0; else x.rate = 0; })} options={BASES.map((b) => ({ value: b, label: cap(b) }))} />
                  <div>{isPct
                    ? <div className="flex items-center gap-1.5"><Num className="w-24" aria-label="Rate in percent" aria-invalid={!!ce("rate")} v={Math.round(c.rate * 1e6) / 1e4} set={(n) => set((x) => { x.rate = n / 100; })} /><span className="text-xs text-muted">%</span></div>
                    : <Num className="w-36" aria-label="Amount in PKR" aria-invalid={!!ce("amount")} v={c.amount} set={(n) => set((x) => { x.amount = n; })} />}
                    {(ce("rate") || ce("amount")) && <p role="alert" className="mt-1 text-xs text-red-500">{ce("rate") || ce("amount")}</p>}</div>
                  <Lvl name={c.label || "Cost"} value={c.verification} onChange={(v) => set((x) => { x.verification = v as any; })} />
                  <Input className="min-w-40 flex-1" aria-label="Note" placeholder="Source or note" value={c.note} onChange={(e) => set((x) => { x.note = e.target.value; })} />
                  <button aria-label={`Remove cost ${i + 1}`} className="px-2 py-2 text-muted hover:text-red-500" onClick={() => mark((m) => { m.costs.splice(i, 1); })}>×</button>
                </div>);
            })}</div>
            <E f="target_margin" />
            <div className="mt-4 flex items-center gap-2 text-sm"><span className="text-muted">Target margin on cost</span>
              <Num className="w-24" aria-label="Target margin percent" v={Math.round(draft.target_margin * 1e6) / 1e4} set={(n) => mark((m) => { m.target_margin = n / 100; })} /><span className="text-muted">%</span></div>
          </Section>

          {o && (
            <Section title="Sensitivity" note="profit when sale prices, construction cost and land price move">
              <div className="grid gap-6 lg:grid-cols-3">{[-10, 0, 10].map((land) => (
                <div key={land}>
                  <p className="mb-2 text-xs text-muted">Land {land > 0 ? "+" : ""}{land}%</p>
                  <table className="w-full text-xs"><thead><tr><th className="pb-1 text-left font-normal text-muted">Sale prices ↓ / construction →</th>{[0, 10, 20].map((c) => <th key={c} className="pb-1 text-right font-normal text-muted">+{c}%</th>)}</tr></thead>
                    <tbody>{[-20, -10, 0, 10].map((p) => (
                      <tr key={p}><td className="py-0.5 text-muted">{p > 0 ? "+" : ""}{p}%</td>
                        {[0, 10, 20].map((c) => {
                          const x = o.sensitivity.find((s) => s.price_pct === p && s.construction_pct === c && s.land_pct === land);
                          return <td key={c} title={x ? exact(x.profit) : ""} className={`px-2 py-1 text-right ${x && x.profit < 0 ? "bg-red-500/15 text-red-600 dark:text-red-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>{x ? crore(x.profit) : "-"}</td>;
                        })}</tr>))}</tbody></table>
                </div>))}</div>
            </Section>
          )}

          <Section title="Compare scenarios">
            {list.length < 2 ? <p className="text-sm text-muted">Add a second scenario (for example Demand and Try) to compare saved results side by side.</p> : (
              <>
                <Select label="Compare with" value={String(other ?? "")} onChange={(v) => setOther(Number(v))} options={[{ value: "", label: "Choose a scenario" }, ...list.filter((e) => e.model.id !== sel).map((e) => ({ value: String(e.model.id), label: e.model.name }))]} />
                {focus?.output && list.find((e) => e.model.id === sel)?.output && (
                  <table className="mt-4 w-full max-w-xl text-sm"><thead><tr className="text-left text-xs font-normal text-muted"><th /><th className="font-normal">{draft.name} (saved)</th><th className="font-normal">{focus.model.name}</th></tr></thead>
                    <tbody>{cmp.map(([k, f]) => <tr key={k} className="border-t border-line"><td className="py-2 text-muted">{k}</td><td>{f(list.find((e) => e.model.id === sel)!.output!)}</td><td>{f(focus.output!)}</td></tr>)}</tbody></table>)}
              </>)}
          </Section>

          <Section title="Snapshots" note="frozen copies of the inputs and results. They can never be edited.">
            <div className="flex flex-wrap items-center gap-2">
              <Input className="max-w-sm" aria-label="Reason for the snapshot" placeholder="Why are you saving this?" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button disabled={!reason.trim() || dirty || !o} onClick={async () => { if (await run(() => post(`/financial-models/${draft.id}/snapshots`, { reason }), "Snapshot saved.")) { setReason(""); loadSnaps(); } }}>Save snapshot</Button>
              {dirty && <span className="text-xs text-muted">Save your changes first.</span>}
            </div>
            <ul className="mt-4 text-sm">{snaps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                <span><span className="font-medium">{s.name}</span> <span className="text-muted">· {s.reason}</span></span>
                <span className="text-muted">{day(s.created_at)} · profit <Money n={s.outputs.profit} /> · {pct(s.outputs.margin_on_cost)} on cost · land <Money n={s.outputs.land} /></span>
              </li>))}{!snaps.length && <li className="text-muted">None yet.</li>}</ul>
          </Section>
        </div>
      )}
    </>
  );
}
