"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { band, dayOf } from "@/lib/bylaws";
import { Can } from "@/components/can";

// What the bylaws allow on this plot, with the working shown so it can be checked by hand.
export function BuildableSummary({ plotId }: { plotId: string }) {
  const [d, setD] = useState<any>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { get(`/plots/${plotId}/buildable`).then(setD); }, [plotId]);
  if (!d) return null;
  const res = d.result, rule = d.rule;
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Buildable area<span className="ml-3 normal-case tracking-normal">{d.use} use</span></h2>
        <Link href="/dashboard/bylaws" className="text-sm text-muted hover:text-ink">Bylaws →</Link>
      </div>
      {res?.total_covered_sqft != null ? (
        <div className="mt-4 text-sm">
          <p><span className="text-3xl font-light tracking-tight">{Math.round(res.total_covered_sqft).toLocaleString()}</span><span className="ml-2 text-muted">sq ft of covered area, limited by {res.binding}</span></p>
          <p className="mt-1.5 text-xs text-muted">Rule: {rule.source} ({band(rule)}, from {dayOf(rule.effective_from)})</p>
          {res.warnings.map((w: string) => <p key={w} className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">{w}</p>)}
          <button onClick={() => setOpen(!open)} className="mt-3 text-xs text-muted hover:text-ink">{open ? "Hide the working" : "Show the working"}</button>
          {open && <ul className="mt-2 grid gap-1 text-xs">{res.steps.map((s: any) => <li key={s.label} className="flex justify-between gap-4 border-b border-line/60 py-1"><span>{s.label}<span className="ml-2 text-muted">{s.note}</span></span><span>{Math.round(s.value).toLocaleString()} {s.unit}</span></li>)}</ul>}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {d.warnings.length ? d.warnings[0] : res ? res.warnings[0] : `No bylaw rule matches ${d.area} for ${d.use} use.`}{" "}
          {!d.warnings.length && <Can area="bylaws"><Link href={`/dashboard/bylaws/new?area=${encodeURIComponent(d.area)}&use=${d.use}`} className="underline hover:text-ink">Add the rule</Link></Can>}
        </p>
      )}
    </section>
  );
}
