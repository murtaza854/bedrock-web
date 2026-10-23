"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get, patch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SECTIONS = ["technical", "financial", "location"];
const n = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));

function Row({ f, onSaved }: { f: any; onSaved: () => void }) {
  const [v, setV] = useState({ weight: f.weight, lo_zero: f.lo_zero, lo_ideal: f.lo_ideal, hi_ideal: f.hi_ideal, hi_zero: f.hi_zero });
  const [err, setErr] = useState("");
  const dirty = JSON.stringify(v) !== JSON.stringify({ weight: f.weight, lo_zero: f.lo_zero, lo_ideal: f.lo_ideal, hi_ideal: f.hi_ideal, hi_zero: f.hi_zero });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => { setErr(""); setV({ ...v, [k]: e.target.value === "" ? null : e.target.value }); };
  const save = async () => {
    try { await patch(`/score/fields/${f.id}`, { weight: n(v.weight) ?? 0, lo_zero: n(v.lo_zero), lo_ideal: n(v.lo_ideal), hi_ideal: n(v.hi_ideal), hi_zero: n(v.hi_zero) }); onSaved(); }
    catch (x) { setErr((x as Error).message || "Could not save"); }
  };
  const cell = (k: keyof typeof v) => <Input type="number" step="any" value={v[k] ?? ""} onChange={set(k)} aria-label={`${f.label} ${k}`} className="!w-20 !px-2.5 !py-1.5 text-right" />;
  return (
    <tr className="border-t border-line align-top">
      <td className="py-3 pr-4"><span className="font-medium">{f.label}</span>{err && <p role="alert" className="mt-1 text-xs text-red-500">{err}</p>}</td>
      <td className="pr-3">{cell("weight")}</td>
      {f.shape === "band" ? [cell("lo_zero"), cell("lo_ideal"), cell("hi_ideal"), cell("hi_zero")].map((c, i) => <td key={i} className="pr-3">{c}</td>)
        : <td colSpan={4} className="pt-3.5 text-xs text-muted">Yes scores full points, no scores zero</td>}
      <td className="text-right">{dirty && <Button onClick={save} className="!px-3 !py-1.5">Save</Button>}</td>
    </tr>
  );
}

export default function Rules() {
  const [profiles, setProfiles] = useState<any[] | null>(null);
  const [sel, setSel] = useState(0);
  const load = () => get("/score/profiles").then((p) => { setProfiles(p); });
  useEffect(() => { load(); }, []);
  const p = profiles?.[sel];
  if (!profiles || !p) return null;
  return (
    <div className="grid gap-10">
      <div>
        <Link href="/dashboard/scorecard" className="text-sm text-muted hover:text-ink">← Scorecard</Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Scoring rules</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">These are your starting guesses, not facts. Each field earns full weight inside its ideal range and fades to zero at the outer points. A weight of 0 switches a field off. Past decisions keep the rules they were saved with.</p>
      </div>

      <div className="flex gap-1 text-sm">
        {profiles.map((x, i) => <button key={x.id} onClick={() => setSel(i)} aria-pressed={sel === i} className={`rounded-md px-3.5 py-1.5 ${sel === i ? "bg-line text-ink" : "text-muted hover:text-ink"}`}>{x.name}</button>)}
      </div>

      {SECTIONS.map((s) => (
        <section key={s} className="border-t border-line pt-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{s}</h2>
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Field</th><th className="pb-2 text-left font-normal">Weight</th><th className="pb-2 text-left font-normal" title="At or below this the field scores zero">Zero below</th><th className="pb-2 text-left font-normal" title="Full points start here">Ideal from</th><th className="pb-2 text-left font-normal" title="Full points end here">Ideal to</th><th className="pb-2 text-left font-normal" title="At or above this the field scores zero">Zero above</th><th /></tr></thead>
            <tbody>{p.fields.filter((f: any) => f.section === s).map((f: any) => <Row key={`${p.id}-${f.id}-${f.weight}-${f.lo_zero}-${f.lo_ideal}-${f.hi_ideal}-${f.hi_zero}`} f={f} onSaved={load} />)}</tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
