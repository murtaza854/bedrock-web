"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { num } from "@/lib/score";

const Kpi = ({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) => (
  <div><p className="text-xs text-muted">{k}</p><p className="mt-1.5 text-3xl font-light tracking-tight">{v}</p><p className="mt-1 min-h-4 text-xs text-muted">{sub}</p></div>
);

export default function Scorecard() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { get("/score/ranking").then((r) => setRows(r.sort((a: any, b: any) => b.score - a.score || b.coverage - a.coverage))); }, []);
  if (!rows) return null;
  const avg = rows.length ? rows.reduce((s, r) => s + r.coverage, 0) / rows.length : 0;
  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scorecard</h1>
          <p className="mt-1 text-sm text-muted">Plots ranked by a fixed set of rules you control. Rejected plots are left out.</p>
        </div>
        <Link href="/dashboard/scorecard/rules" className="rounded-lg bg-line/50 px-3.5 py-2 text-sm font-medium hover:bg-line">Edit rules</Link>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-3">
        <Kpi k="Plots scored" v={rows.length} />
        <Kpi k="Highest score" v={rows.length ? num(rows[0].score) : "-"} sub={rows.length ? rows[0].plot_label : ""} />
        <Kpi k="Average verified" v={`${num(avg)}%`} sub="share of each score backed by evidence" />
      </div>

      <section className="border-t border-line pt-5">
        {rows.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted"><th className="w-8 pb-2 text-left font-normal">#</th><th className="pb-2 text-left font-normal">Plot</th><th className="pb-2 text-right font-normal">Score</th><th className="pb-2 text-right font-normal">Verified</th><th className="pb-2 pl-6 text-left font-normal">Profile</th><th className="pb-2 pl-6 text-left font-normal">Next step</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.plot_id} className="border-t border-line">
                <td className="py-3 text-muted">{i + 1}</td>
                <td><Link href={`/dashboard/plots/${r.plot_id}/score`} className="font-medium">{r.plot_label}</Link></td>
                <td className="text-right"><b className="text-base font-medium">{num(r.score)}</b></td>
                <td className="text-right text-muted">{num(r.coverage)}%</td>
                <td className="pl-6 text-muted">{r.profile}</td>
                <td className="pl-6 text-muted">{r.next ?? "-"}</td>
              </tr>))}</tbody>
          </table>
        ) : <p className="text-sm text-muted">No plots to score yet.</p>}
        <p className="mt-6 max-w-2xl text-xs text-muted">A low score with a low "verified" share means the plot is mostly unchecked, not that it is bad. Compare plots with similar verified shares, and revisit the rules after 20 to 30 plots.</p>
      </section>
    </div>
  );
}
