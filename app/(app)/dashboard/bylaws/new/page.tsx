"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { USES, today } from "@/lib/bylaws";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tri } from "@/components/ui/tri";

const Lbl = ({ children, hint }: { children: React.ReactNode; hint?: string }) => <p className="mb-1.5 text-xs text-muted">{children}{hint && <span className="ml-1.5 opacity-70">{hint}</span>}</p>;
const Group = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="border-t border-line pt-5"><h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}{note && <span className="ml-3 normal-case tracking-normal">{note}</span>}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div></section>
);
const NUMS = ["min_sqyd", "max_sqyd", "far", "max_coverage_pct", "max_floors", "max_height_ft", "setback_front_ft", "setback_rear_ft", "setback_side_ft"];

export default function NewRule() {
  const router = useRouter();
  const [areas, setAreas] = useState<string[]>([]);
  const [def, setDef] = useState({ area: "", use: "residential" });
  const [use, setUse] = useState("residential");
  const [basement, setBasement] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    get("/plots").then((p) => setAreas([...new Set<string>(p.map((x: any) => x.area))].sort()));
    const q = new URLSearchParams(location.search), u = q.get("use") ?? "residential";
    setDef({ area: q.get("area") ?? "", use: u }); setUse(u); setReady(true);
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const err: Errors = {};
    if (!f.area.trim()) err.area = "Which area does the rule apply to?";
    if (!f.source.trim()) err.source = "Name the circular, clause or page it comes from";
    if (!f.effective_from) err.effective_from = "Enter the date it took effect";
    for (const k of NUMS) if (f[k] && !(Number(f[k]) >= 0)) err[k] = "Enter a number";
    if (f.max_coverage_pct && (Number(f.max_coverage_pct) <= 0 || Number(f.max_coverage_pct) > 100)) err.max_coverage_pct = "Between 0 and 100";
    if (f.min_sqyd && f.max_sqyd && Number(f.min_sqyd) >= Number(f.max_sqyd)) err.max_sqyd = "Must be above the smallest size";
    if (!f.far && !f.max_coverage_pct && !f.max_floors && !f.max_height_ft) err.limits = "Enter at least one limit: a floor area ratio, coverage, floors or height";
    setErrors(err);
    if (Object.keys(err).length) return;
    const body: Record<string, unknown> = { area: f.area, use_type: use, notes: f.notes, source: f.source, effective_from: f.effective_from, basement_allowed: basement === "" ? null : basement === "yes" };
    for (const k of NUMS) body[k] = f[k] === "" ? null : Number(f[k]);
    setBusy(true);
    try { await post("/bylaws", body); router.push("/dashboard/bylaws"); }
    catch (x) { setBusy(false); setErrors({ form: (x as Error).message || "Could not save" }); }
  };
  if (!ready) return null;
  const num = (k: string, text: string, hint?: string) => <div><Lbl hint={hint}>{text}</Lbl><Field name={k} type="number" step="any" min="0" error={errors[k]} /></div>;
  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bylaws" className="text-sm text-muted hover:text-ink">← Bylaws</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add a bylaw rule</h1>
      <p className="mt-1 text-sm text-muted">Enter only limits the circular actually states. A blank limit is not applied, and is never guessed.</p>
      <form onSubmit={submit} noValidate className="mt-8 grid gap-8">
        <Group title="Where it applies">
          <div><Lbl>Area</Lbl><Field name="area" list="areas" defaultValue={def.area} error={errors.area} placeholder="Same name as on your plots" autoComplete="off" autoFocus /><datalist id="areas">{areas.map((a) => <option key={a} value={a} />)}</datalist></div>
          <div><Lbl>Use</Lbl><Select label="Use" value={use} onChange={setUse} options={USES} /></div>
          {num("min_sqyd", "Plot size from (sq yd, optional)")}{num("max_sqyd", "Plot size below (sq yd, optional)")}
        </Group>
        <Group title="Limits" note="at least one">
          {num("far", "Floor area ratio (FAR)", "e.g. 1.5")}{num("max_coverage_pct", "Ground coverage (%)")}
          {num("max_floors", "Maximum floors")}{num("max_height_ft", "Maximum height (ft)")}
          {errors.limits && <p role="alert" className="text-xs text-red-500 sm:col-span-2">{errors.limits}</p>}
        </Group>
        <Group title="Setbacks" note="optional, applied when the plot's frontage is known">
          {num("setback_front_ft", "Front (ft)")}{num("setback_rear_ft", "Rear (ft)")}{num("setback_side_ft", "Each side (ft)")}
          <div className="flex items-end pb-1"><div className="w-full"><Tri label="Basement allowed" value={basement} onChange={setBasement} /></div></div>
        </Group>
        <Group title="Source">
          <div className="sm:col-span-2"><Lbl>Circular, clause or page</Lbl><Field name="source" error={errors.source} placeholder="Where this comes from, so it can be checked" /></div>
          <div><Lbl>Took effect on</Lbl><Field name="effective_from" type="date" defaultValue={today()} error={errors.effective_from} /></div>
          <div className="sm:col-span-2"><Lbl>Notes (optional)</Lbl><Textarea name="notes" rows={2} /></div>
        </Group>
        <div className="flex items-center gap-2"><Button disabled={busy}>Save rule</Button><Link href="/dashboard/bylaws" className="rounded-lg bg-line/50 px-4 py-2.5 text-sm font-medium hover:bg-line">Cancel</Link></div>
        {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}
      </form>
    </div>
  );
}
