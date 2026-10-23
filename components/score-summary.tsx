"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { num } from "@/lib/score";

// One-line score on the plot page; the breakdown lives on /score.
export function ScoreSummary({ plotId }: { plotId: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { get(`/plots/${plotId}/score`).then(setD); }, [plotId]);
  if (!d) return null;
  const top = d.next_steps[0];
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Scorecard<span className="ml-3 normal-case tracking-normal">{d.profile.name} profile</span></h2>
        <Link href={`/dashboard/plots/${plotId}/score`} className="text-sm text-muted hover:text-ink">Open scorecard →</Link>
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span><span className="text-3xl font-light tracking-tight">{num(d.score)}</span><span className="ml-1 text-muted">/ 100</span></span>
        <span className="text-muted">{num(d.coverage)}% of the score is verified</span>
        {top && <span className="text-muted">Next: {top.label} (+{top.gain})</span>}
      </div>
    </section>
  );
}
