"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { get, post, put } from "@/lib/api";
import { label } from "@/lib/plots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StepBar } from "@/components/step-bar";
import { Output, apiErrors, blankFloor, pct } from "@/lib/feasibility";

// A rough feasibility, step by step: areas and prices in, profit out. Saves into the same scenarios as the detailed model.
// Everything not asked here is a fixed simplification: all area sellable, one construction rate (basement included),
// the same construction time for every building, no taxes or fees. The detailed model is for plots that are really bought.
// ponytail: one fixed coverage guess (DHA Karachi's commercial rule for 251 to 400 sq yd is 90%); make it a setting if you want another
const COVERAGE = 0.9;
const n = (s: string) => (s.trim() === "" ? 0 : Number(s));
const f = (x: number) => x.toLocaleString("en-US");
const Q = ({ k, children }: { k: string; children: React.ReactNode }) => <label className="block"><span className="mb-1.5 block text-xs text-muted">{k}</span>{children}</label>;

// One building's answers. With two buildings each has its own.
// Floors above ground come in groups: floors of the same size, price and sellable share (a mezzanine, floors 1 to 2, floors 3 to 11).
type Grp = { name: string; count: string; sqft: string; sell: string; sold: string; price: string };
const blankGrp = (): Grp => ({ name: "", count: "", sqft: "", sell: "100", sold: "office", price: "" });
type Bld = { gSqft: string; gPrice: string; gSell: string; ups: Grp[]; bCount: string; bSqft: string };
const blank = (): Bld => ({ gSqft: "", gPrice: "", gSell: "100", ups: [blankGrp()], bCount: "", bSqft: "" });
const SOLD = [{ value: "office", label: "Offices" }, { value: "apartment", label: "Apartments" }, { value: "shop", label: "Shops" }];
// the name a group's floors carry: "Mezzanine", or "Floors 1 to 2 1" and "Floors 1 to 2 2" when it has several. Unnamed: "Floor 1", "Floor 2".
const floorLabel = (name: string, j: number, count: number) => { const nm = name.trim(); return nm && count === 1 && !/\d$/.test(nm) ? nm : `${nm || "Floor"} ${j + 1}`; };
type Step = { k: "b" | "c" | "t" | "r" } | { k: "g" | "u" | "s"; i: number };
const stepsFor = (N: number): Step[] => [{ k: "b" }, ...Array.from({ length: N }, (_, i): Step[] => [{ k: "g", i }, { k: "u", i }, { k: "s", i }]).flat(), { k: "c" }, { k: "t" }, { k: "r" }];

// A projection shown beside the field, not typed into it: one click to use it.
const Suggest = ({ text, value, current, use }: { text: string; value: number; current: string; use: () => void }) =>
  value > 0 && n(current) !== value ? (
    <p className="text-xs text-muted sm:col-span-2">Suggested: <b className="font-medium text-ink">{f(value)} sq ft</b> {text} <button type="button" onClick={use} className="ml-1 underline hover:text-ink">Use this</button></p>
  ) : null;

// 167 & 169 is two plots. One building on both joins them; two buildings on one plot splits it.
const process = (parts: string, buildings: string) =>
  parts === "2" && buildings === "1" ? "Needs amalgamation of the two plots." : parts === "1" && buildings === "2" ? "Needs bifurcation of the plot." :
  parts === "2" && buildings === "2" ? "No amalgamation or bifurcation needed: one building on each plot." : "";

// Turns a saved scenario back into the wizard's answers, or says why the quick form cannot show it.
// Several buildings are saved as one scenario with floors labelled "Building 2 – Ground".
function fromModel(m: any): { bl: Bld[]; v: Record<string, string>; buildings: string } | string {
  const groups = new Map<string, any[]>();
  for (const x of m.floors as any[]) { const k = /^Building (\d+) – /.exec(x.label)?.[1] ?? "1"; groups.set(k, [...(groups.get(k) ?? []), x]); }
  const s = (x: number) => (x ? String(x) : "");
  const bl: Bld[] = [];
  for (const fl of [...groups.entries()].sort(([a], [b]) => Number(a) - Number(b)).map(([, g]) => g)) {
    const g = fl.filter((x) => x.floor_type === "ground"), up = fl.filter((x) => x.floor_type === "upper"), bs = fl.filter((x) => x.floor_type === "basement");
    if (g.length !== 1 || g.length + up.length + bs.length !== fl.length || bs.some((x) => x.built_area_sqft !== bs[0].built_area_sqft || x.sellable_ratio !== 0 || x.price_per_sqft !== 0)
      || fl.some((x) => x.price_mode !== "per_sqft" || !["shop", "office", "apartment", "other"].includes(x.use) || (x.floor_type !== "basement" && !(x.sellable_ratio > 0))))
      return "This scenario has details the quick form cannot show (a different price basis, floor type or use), so it can only be edited in the detailed model.";
    const pct = (r: number) => String(Math.round(r * 10000) / 100);
    const ups: Grp[] = [];
    for (const x of up) {
      const nm = String(x.label).replace(/^Building \d+ – /, "").replace(/\s\d+$/, "");
      const cand: Grp = { name: nm === "Floor" ? "" : nm, count: "1", sqft: s(x.built_area_sqft), sell: pct(x.sellable_ratio), sold: ["apartment", "shop"].includes(x.use) ? x.use : "office", price: s(x.price_per_sqft) };
      const last = ups[ups.length - 1], key = (q: Grp) => [q.name, q.sqft, q.sell, q.sold, q.price].join("|");
      if (last && key(last) === key(cand)) last.count = String(Number(last.count) + 1); else ups.push(cand);
    }
    bl.push({ gSqft: s(g[0].built_area_sqft), gPrice: s(g[0].price_per_sqft), gSell: pct(g[0].sellable_ratio), ups: ups.length ? ups : [blankGrp()], bCount: s(bs.length), bSqft: s(bs[0]?.built_area_sqft) });
  }
  if (m.costs.some((c: any) => c.amount || c.rate) || bl.length > 2) return "This scenario has other costs, so it can only be edited in the detailed model.";
  return { bl, buildings: String(bl.length), v: { rate: s(m.construction_per_sqft), tYears: s(Math.floor(m.construction_months / 12)), tMonths: s(m.construction_months % 12) } };
}

export default function Feasibility({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [plot, setPlot] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [buildings, setBuildings] = useState("1"); // one building on the whole land, or two on half each
  const [parts, setParts] = useState("1"); // the land is one plot, or two joined (like 167 & 169)
  const [bl, setBl] = useState<Bld[]>([blank(), blank()]);
  const [v, setV] = useState({ rate: "", tYears: "", tMonths: "" });
  const [lands, setLands] = useState([{ label: "Demand", cr: "" }]);
  const [res, setRes] = useState<Output[][]>([]); // res[view][land]: each building, then combined
  const [view, setView] = useState(0);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<any>(null); // a saved scenario being changed, from ?scenario=ID
  const [blocked, setBlocked] = useState("");
  useEffect(() => {
    get(`/plots/${id}`).then((d) => { setPlot(d.plot); setParts(/[&,]|\band\b/i.test(d.plot.plot_no) ? "2" : "1"); });
    const sid = new URLSearchParams(location.search).get("scenario");
    if (sid) get(`/financial-models/${sid}`).then(({ model: m }) => {
      if (String(m.plot_id) !== id) return setBlocked("That scenario belongs to another plot.");
      const r = fromModel(m);
      if (typeof r === "string") return setBlocked(r);
      setEditing(m); setBl([...r.bl, blank(), blank()].slice(0, 2)); setV(r.v as typeof v); setBuildings(r.buildings); setLands([{ label: m.name, cr: String(m.land_price) }]);
    }).catch(() => setBlocked("That scenario could not be found."));
  }, [id]);

  const N = Number(buildings);
  const steps = stepsFor(N);
  const RESULT = steps.length - 1;
  const cur = steps[step];
  const months = n(v.tYears) * 12 + n(v.tMonths); // construction time, for the monthly and annual profit
  const upd = (i: number, k: "gSqft" | "gPrice" | "gSell" | "bCount" | "bSqft", val: string) => setBl((all) => all.map((b, j) => (j === i ? { ...b, [k]: val } : b)));
  const updG = (i: number, gi: number, k: keyof Grp, val: string) => setBl((all) => all.map((b, j) => (j === i ? { ...b, ups: b.ups.map((g, q) => (q === gi ? { ...g, [k]: val } : g)) } : b)));
  const num = (i: number, k: "gSqft" | "gPrice" | "gSell" | "bCount" | "bSqft", ph: string) => <Input type="number" min={0} step="any" value={bl[i][k]} onChange={(e) => upd(i, k, e.target.value)} placeholder={ph} />;
  const numG = (i: number, gi: number, k: "count" | "sqft" | "sell" | "price", ph: string) => <Input type="number" min={0} step="any" value={bl[i].ups[gi][k]} onChange={(e) => updG(i, gi, k, e.target.value)} placeholder={ph} />;
  const numV = (k: keyof typeof v, ph: string) => <Input type="number" min={0} step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={ph} />;

  // a model of the given buildings with the given amount of land. Several buildings together get "Building 2 – " labels.
  const modelOf = (idx: number[], land: number, name: string) => {
    const floor = (o: object) => ({ ...blankFloor(), ...o });
    const floors = idx.flatMap((i) => {
      const b = bl[i], pre = idx.length > 1 ? `Building ${i + 1} – ` : "";
      return [
        floor({ label: `${pre}Ground`, floor_type: "ground", use: "shop", built_area_sqft: n(b.gSqft), sellable_ratio: n(b.gSell) / 100, price_per_sqft: n(b.gPrice) }),
        ...b.ups.flatMap((g) => Array.from({ length: n(g.count) }, (_, j) => floor({ label: `${pre}${floorLabel(g.name, j, n(g.count))}`, floor_type: "upper", use: g.sold, built_area_sqft: n(g.sqft), sellable_ratio: n(g.sell) / 100, price_per_sqft: n(g.price) }))),
        ...Array.from({ length: n(b.bCount) }, (_, j) => floor({ label: `${pre}Basement ${j + 1}`, floor_type: "basement", use: "other", built_area_sqft: n(b.bSqft), sellable_ratio: 0 })),
      ];
    });
    return { plot_id: Number(id), name, land_price_basis: "manual", plot_area_sqyd: (plot.size_sqyd * idx.length) / N, floors, land_price: land,
      land_verification: "claimed", construction_per_sqft: n(v.rate), construction_covers: "unknown", construction_verification: "claimed", costs: [], target_margin: 0.2, construction_months: months };
  };
  const all = Array.from({ length: N }, (_, i) => i);
  const model = (l: { label: string; cr: string }) => modelOf(all, Math.round(n(l.cr)), l.label);

  const ready = (): boolean => {
    const share = (x: string) => n(x) > 0 && n(x) <= 100;
    if (cur.k === "g") return n(bl[cur.i].gSqft) > 0 && n(bl[cur.i].gPrice) > 0 && share(bl[cur.i].gSell);
    if (cur.k === "u") return bl[cur.i].ups.every((g) => n(g.count) === 0 || (n(g.sqft) > 0 && n(g.price) > 0 && share(g.sell)));
    if (cur.k === "s") return n(bl[cur.i].bCount) === 0 || n(bl[cur.i].bSqft) > 0;
    if (cur.k === "c") return n(v.rate) > 0 && lands.every((l) => l.label.trim() && n(l.cr) > 0);
    if (cur.k === "t") return months > 0;
    return true;
  };
  const compute = (m: object) => post("/financial/compute", m).then((r) => { if (r.errors?.length) throw new Error(r.errors[0].message); return r.output as Output; });
  const next = async () => {
    if (step < RESULT - 1) return setStep(step + 1);
    setErr("");
    try {
      // each building on its own (its share of the land), then everything together
      const views = N > 1 ? [...all.map((i) => (l: typeof lands[0]) => modelOf([i], Math.round(n(l.cr) / N), l.label)), model] : [model];
      setRes(await Promise.all(views.map((mk) => Promise.all(lands.map((l) => compute(mk(l)))))));
      setView(views.length - 1);
      setStep(RESULT);
    } catch (x) { setErr((x as Error).message); }
  };
  const save = async () => {
    setErr("");
    try {
      if (editing) await put(`/financial-models/${editing.id}`, { ...editing, ...model(lands[0]), id: editing.id, costs: editing.costs });
      else for (const l of lands) {
        const d = await post(`/plots/${id}/financial-models`, { name: l.label });
        await put(`/financial-models/${d.id}`, { ...d, ...model(l), id: d.id, costs: d.costs });
      }
      router.push(`/dashboard/plots/${id}`); // saved: back to the plot
    } catch (x) { setErr(apiErrors(x)[0]?.message ?? "Could not save"); }
  };

  if (!plot) return null;
  if (!(plot.size_sqyd > 0)) return <p className="max-w-md text-sm text-muted">Add the plot's size first: <Link className="underline" href={`/dashboard/plots/${id}/edit`}>edit the plot</Link>.</p>;
  if (blocked) return <div className="max-w-md text-sm text-muted"><p>{blocked}</p><Link className="mt-3 inline-block underline" href={`/dashboard/plots/${id}`}>Back to the plot</Link></div>;

  const who = "i" in cur && N > 1 ? `Building ${cur.i + 1}: ` : "";
  const title = { b: "Buildings", g: `${who}Ground floor`, u: `${who}Upper floors`, s: `${who}Basement`, c: "Cost and land", t: "Construction time", r: "Result" }[cur.k];
  const asked = { b: "How many buildings, and what the land is. Each building gets its own answers and its own result.", g: "Projected ground floor area, the share of it you can sell, and what you expect to sell it for.",
    u: "Floors above ground, in groups of floors that share a size and a price (a mezzanine, floors 1 to 2, floors 3 to 11). Most plots need just one group.", s: "Floors below ground, for parking for example. They are built and cost money but are not sold. No basement? Leave it blank.",
    c: "What building costs per sq ft, and what you would pay for the land. Add a row for each price you want to compare.", t: "How long construction takes, for every building. The profit per month and per year is worked out from it.", r: "" }[cur.k];
  const gArea = (i: number) => Math.round((plot.size_sqyd / N) * 9 * COVERAGE);

  // the answers for one building, with the working, as you would do it by hand
  const sellable = (area: number, sell: number) => (sell === 1 ? "" : ` × ${Math.round(sell * 10000) / 100}% sellable = ${f(area * sell)} sq ft`);
  const builtOf = (i: number) => n(bl[i].gSqft) + bl[i].ups.reduce((a, g) => a + n(g.count) * n(g.sqft), 0) + n(bl[i].bCount) * n(bl[i].bSqft);
  const entered = (i: number, pre: string): [string, string][] => {
    const b = bl[i], g = n(b.gSqft), gs = n(b.gSell) / 100, bs = n(b.bCount) * n(b.bSqft), built = builtOf(i), upArea = built - g - bs;
    return [
      [`${pre}Ground floor`, `${f(g)} sq ft${sellable(g, gs)} × ${f(n(b.gPrice))} = ${f(Math.round(g * gs * n(b.gPrice)))}`],
      ...b.ups.filter((u) => n(u.count) > 0).map((u): [string, string] => {
        const c = n(u.count), a = n(u.sqft), sl = n(u.sell) / 100;
        return [`${pre}${u.name.trim() || "Upper floors"} (${u.sold}s)`, `${f(c)} × ${f(a)} = ${f(c * a)} sq ft${sellable(c * a, sl)} × ${f(n(u.price))} = ${f(Math.round(a * sl * n(u.price)) * c)}`];
      }),
      ...(n(b.bCount) > 0 ? [[`${pre}Basement`, `${f(n(b.bCount))} × ${f(n(b.bSqft))} = ${f(bs)} sq ft, not sold`] as [string, string]] : []),
      [`${pre}Built area`, `${f(g)}${upArea ? ` + ${f(upArea)}` : ""}${bs ? ` + ${f(bs)}` : ""} = ${f(built)} sq ft × ${f(n(v.rate))} construction = ${f(built * n(v.rate))}`],
    ];
  };
  const combined = N === 1 || view === N;
  const rows: [string, string][] = [
    ...(N > 1 && combined ? [["Buildings", `${N}, each on ${f(plot.size_sqyd / N)} sq yd (${f((plot.size_sqyd / N) * 9)} sq ft). The land price is for all the land, each building gets half.`] as [string, string]] : []),
    ...(combined && process(parts, buildings) ? [["Process", process(parts, buildings) + " Any fee is not included."] as [string, string]] : []),
    ...(combined ? all.flatMap((i) => entered(i, N > 1 ? `Building ${i + 1} – ` : "")) : entered(view, "")),
    ...(N > 1 && combined ? [["Total built area", `${all.map((i) => f(builtOf(i))).join(" + ")} = ${f(all.reduce((a, i) => a + builtOf(i), 0))} sq ft × ${f(n(v.rate))} = ${f(all.reduce((a, i) => a + builtOf(i), 0) * n(v.rate))}`] as [string, string]] : []),
    ["Construction time", `${n(v.tYears)} ${n(v.tYears) === 1 ? "year" : "years"} ${n(v.tMonths)} ${n(v.tMonths) === 1 ? "month" : "months"} = ${f(months)} months`],
  ];
  const views = N > 1 ? [...all.map((i) => `Building ${i + 1}`), "Combined"] : [""];
  const outs = res[view] ?? [];

  return (
    <div className="max-w-3xl">
      <Link href={`/dashboard/plots/${id}`} className="text-sm text-muted hover:text-ink">← {label(plot)}</Link>
      {editing && <p className="mt-4 text-sm text-muted">Editing the scenario <b className="font-medium text-ink">{editing.name}</b></p>}
      <div className="mt-4"><StepBar step={step} total={steps.length} /></div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{cur.k === "b" && `Plot is ${plot.size_sqyd} sq yd (${plot.size_sqyd * 9} sq ft). `}{asked}</p>

      <form noValidate onSubmit={(e) => { e.preventDefault(); if (step < RESULT && ready()) next(); }}> {/* Enter does what the Next button does */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cur.k === "b" && <>
          <Q k="Buildings"><Select label="Buildings" value={buildings} onChange={(x) => { setBuildings(x); setStep(0); }} options={[{ value: "1", label: "One building on the whole plot" }, { value: "2", label: "Two buildings, each on half the plot" }]} /></Q>
          <Q k="The land is"><Select label="The land is" value={parts} onChange={setParts} options={[{ value: "1", label: "One plot" }, { value: "2", label: "Two plots joined (like 167 & 169)" }]} /></Q>
          {process(parts, buildings) && <p className="text-sm sm:col-span-2">{process(parts, buildings)} <span className="text-muted">Any fee is not included.</span></p>}
        </>}
        {cur.k === "g" && <><Q k="Ground floor (sq ft)">{num(cur.i, "gSqft", "e.g. 1650")}</Q><Q k="Sale price per sq ft (PKR)">{num(cur.i, "gPrice", "e.g. 120000")}</Q><Q k="Sellable share (%)">{num(cur.i, "gSell", "e.g. 85")}</Q><div />
          <Suggest text={`(${Math.round(COVERAGE * 100)}% of ${N === 1 ? "the plot" : "half the plot"})`} value={gArea(cur.i)} current={bl[cur.i].gSqft} use={() => upd(cur.i, "gSqft", String(gArea(cur.i)))} />
          {cur.i > 0 && <p className="text-xs text-muted sm:col-span-2"><button type="button" onClick={() => setBl((all) => all.map((b, j) => (j === cur.i ? { ...all[0], ups: all[0].ups.map((u) => ({ ...u })) } : b)))} className="underline hover:text-ink">Copy everything from Building 1</button>, then change what differs.</p>}</>}
        {cur.k === "u" && <>
          {bl[cur.i].ups.map((g, gi) => {
            const sfx = gi === 0 ? "" : `, group ${gi + 1}`;
            return (
              <div key={gi} className="grid gap-4 rounded-lg border border-line p-4 sm:col-span-2 sm:grid-cols-2">
                <Q k={`Group name${sfx}`}><Input value={g.name} onChange={(e) => updG(cur.i, gi, "name", e.target.value)} placeholder="e.g. Mezzanine, Floors 1 to 2" /></Q><div />
                <Q k={`Number of floors above ground${sfx}`}>{numG(cur.i, gi, "count", "e.g. 4")}</Q><Q k={`Area of each floor (sq ft)${sfx}`}>{numG(cur.i, gi, "sqft", "e.g. 2040")}</Q>
                <Suggest text="(same as the ground floor)" value={n(bl[cur.i].gSqft)} current={g.sqft} use={() => updG(cur.i, gi, "sqft", bl[cur.i].gSqft)} />
                <Q k={`Sold as${sfx}`}><Select label={`Sold as${sfx}`} value={g.sold} onChange={(x) => updG(cur.i, gi, "sold", x)} options={SOLD} /></Q>
                <Q k={`Sellable share (%)${sfx}`}>{numG(cur.i, gi, "sell", "e.g. 75")}</Q>
                <Q k={`Sale price per sq ft (PKR), ${g.sold}s${sfx}`}>{numG(cur.i, gi, "price", "e.g. 30000")}</Q>
                {gi > 0 && <div className="flex items-end"><Button type="button" variant="ghost" onClick={() => setBl((all) => all.map((b, j) => (j === cur.i ? { ...b, ups: b.ups.filter((_, q) => q !== gi) } : b)))}>Remove this group</Button></div>}
              </div>);
          })}
          <button type="button" onClick={() => setBl((all) => all.map((b, j) => (j === cur.i ? { ...b, ups: [...b.ups, blankGrp()] } : b)))} className="text-left text-sm text-muted hover:text-ink sm:col-span-2">+ Add another group of floors</button>
        </>}
        {cur.k === "s" && <><Q k="Number of basement floors">{num(cur.i, "bCount", "e.g. 2")}</Q><Q k="Area of each basement floor (sq ft)">{num(cur.i, "bSqft", "e.g. 1800")}</Q></>}
        {cur.k === "t" && <><Q k="Years">{numV("tYears", "e.g. 2")}</Q><Q k="Months">{numV("tMonths", "e.g. 6")}</Q></>}
        {cur.k === "c" && <>
          <Q k="Construction cost per sq ft (PKR), same for every floor">{numV("rate", "e.g. 7000")}</Q><div />
          {lands.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-4 sm:col-span-2">
              <Q k={i ? `Scenario ${i + 1} name` : "Scenario name"}><Input value={l.label} onChange={(e) => setLands(lands.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Scenario name" /></Q>
              <Q k={N > 1 || parts === "2" ? "Land price (PKR), one price for all the land" : "Land price (PKR)"}><div className="flex gap-2"><Input type="number" min={0} step="any" value={l.cr} placeholder="e.g. 300000000" aria-label="Land price in PKR" onChange={(e) => setLands(lands.map((x, j) => (j === i ? { ...x, cr: e.target.value } : x)))} />
                {i > 0 && !editing && <Button type="button" variant="ghost" onClick={() => setLands(lands.filter((_, j) => j !== i))}>Remove</Button>}</div></Q>
            </div>))}
          {!editing && <button type="button" onClick={() => setLands([...lands, { label: `Scenario ${lands.length + 1}`, cr: "" }])} className="text-left text-sm text-muted hover:text-ink sm:col-span-2">+ Add another land price</button>}
        </>}
      </div>

      {cur.k === "r" && <>
        {N > 1 && <div className="mt-6 flex gap-2 text-sm">{views.map((t, i) => (
          <button key={t} type="button" aria-pressed={view === i} onClick={() => setView(i)} className={`rounded-lg px-3.5 py-2 ${view === i ? "bg-ink text-bg" : "bg-line/50 hover:bg-line"}`}>{t}</button>))}</div>}
        <dl className="mt-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">{rows.map(([k, x], q) => <div key={`${q}${k}`} className="contents"><dt className="text-muted">{k}</dt><dd>{x}</dd></div>)}</dl>
        <table className="mt-6 w-full text-sm">
          <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">PKR{N > 1 ? `, ${views[view]}` : ""}</th>{lands.map((l) => <th key={l.label} className="pb-2 text-right font-normal">{l.label}</th>)}</tr></thead>
          <tbody>{([["Revenue", "revenue"], ["Construction", "construction"], ["Land", "land"], ["Total cost", "total_cost"], ["Profit", "profit"]] as const).map(([k, fld], r) => (
            <tr key={k} className={`border-t border-line ${r === 4 ? "font-medium" : ""}`}><td className="py-2.5 text-muted">{k}</td>
              {outs.map((o, i) => <td key={i} className="text-right">{f(o[fld])}</td>)}</tr>))}
            <tr className="border-t border-line"><td className="py-2.5 text-muted">Monthly profit</td>{outs.map((o, i) => <td key={i} className="text-right">{f(Math.round(o.profit / months))}</td>)}</tr>
            <tr className="border-t border-line"><td className="py-2.5 text-muted">Annual profit</td>{outs.map((o, i) => <td key={i} className="text-right">{f(Math.round((o.profit / months) * 12))}</td>)}</tr>
            <tr className="border-t border-line font-medium"><td className="py-2.5 text-muted">Profit on cost</td>{outs.map((o, i) => <td key={i} className="text-right">{pct(o.margin_on_cost)}</td>)}</tr></tbody>
        </table></>}
      {err && <p role="alert" className="mt-4 text-sm text-red-500">{err}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {step > 0 && <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
        {step < RESULT ? <Button disabled={!ready()}>{step === RESULT - 1 ? "Work it out" : cur.k === "s" && n(bl[cur.i].bCount) === 0 ? "No basement" : "Next"}</Button>
          : <Button type="button" onClick={save}>{editing ? "Save changes" : `Save as ${lands.length > 1 ? "scenarios" : "a scenario"}`}</Button>}
        {step === RESULT && plot.status === "bought" && <Link href={`/dashboard/plots/${id}/financials`} className="ml-auto text-sm text-muted hover:text-ink">Detailed model →</Link>}
      </div>
      </form>
    </div>
  );
}
