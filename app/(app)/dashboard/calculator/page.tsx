"use client";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { SEED_AREAS } from "@/lib/areas";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Errors, Field, required } from "@/components/ui/field";
import { Draft, FeasibilityWizard } from "@/components/feasibility-wizard";

// A quick way in: a name, an area and a size, then straight to the feasibility. The plot is only added when you save the result.
export default function Calculator() {
  const [errors, setErrors] = useState<Errors>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [used, setUsed] = useState<string[]>([]); // areas you have already used come first, as in the plot form
  useEffect(() => { get("/plots").then((ps: any[]) => setUsed([...new Set<string>(ps.map((p) => p.area))].sort())).catch(() => {}); }, []);
  const start = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const err = required(f, { plot_no: "Give the plot a name or number" });
    if (!(Number(f.size) > 0)) err.size = "Enter the size in square yards";
    setErrors(err);
    if (Object.keys(err).length) return;
    setDraft({ plot_no: f.plot_no.trim(), area: f.area.trim() || "Unknown", size_sqyd: Math.round(Number(f.size)) });
  };
  if (draft) return <FeasibilityWizard id={null} draft={draft} />;
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Calculator</h1>
      <p className="mt-1 text-sm text-muted">Work out a feasibility without setting the plot up first. The plot is added when you save the result, and you can fill in the rest later.</p>
      <form onSubmit={start} noValidate className="mt-8 grid gap-5">
        <div><p className="mb-1.5 text-xs text-muted">Plot name or number</p><Field name="plot_no" placeholder="e.g. 174 & 176" error={errors.plot_no} autoFocus /></div>
        <div><p className="mb-1.5 text-xs text-muted">Area (optional)</p><Combobox name="area" label="Area" placeholder="DHA Phase 8, Bahadurabad, ..." options={SEED_AREAS} first={used} /></div>
        <div><p className="mb-1.5 text-xs text-muted">Size (sq yd)</p><Field name="size" type="number" placeholder="e.g. 400" error={errors.size} /></div>
        <div><Button>Start</Button></div>
      </form>
    </div>
  );
}
