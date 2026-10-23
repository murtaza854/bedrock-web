"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { Entry, crore, pct } from "@/lib/feasibility";

export function FinancialSummary({ plotId }: { plotId: string }) {
  const [list, setList] = useState<Entry[] | null>(null);
  useEffect(() => { get(`/plots/${plotId}/financial-models`).then(setList).catch(() => setList([])); }, [plotId]);
  if (!list) return null;
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Financials<span className="ml-3 normal-case tracking-normal">{list.length} {list.length === 1 ? "scenario" : "scenarios"}</span></h2>
        <Link href={`/dashboard/plots/${plotId}/financials`} className="text-sm text-muted hover:text-ink">Open</Link>
      </div>
      {list.length ? (
        <ul className="mt-4 text-sm">{list.map(({ model: m, output: o, errors }) => (
          <li key={m.id} className="flex items-center justify-between gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0">
            <span className="font-medium">{m.name}{m.is_primary && <span className="ml-2 text-xs text-muted">primary</span>}</span>
            <span className="text-muted">{errors?.length || !o ? "Incomplete" : `Profit ${crore(o.profit)} · ${pct(o.margin_on_cost)} on cost`}</span>
          </li>))}</ul>
      ) : <p className="mt-4 text-sm text-muted">No model yet. Work out what this plot can pay for the land.</p>}
    </section>
  );
}
