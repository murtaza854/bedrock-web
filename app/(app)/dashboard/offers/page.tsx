"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { get } from "@/lib/api";
import { STATUS_TONE, TURN, dayStr, money, position } from "@/lib/offers";
import { cap } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Can } from "@/components/can";

const Kpi = ({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) => (
  <div><p className="text-xs text-muted">{k}</p><p className="mt-1.5 text-3xl font-light tracking-tight">{v}</p><p className="mt-1 min-h-4 text-xs text-muted">{sub}</p></div>
);

export default function Offers() {
  const [list, setList] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"open" | "closed" | "all">("open");
  useEffect(() => { get("/negotiations").then(setList); }, []);
  const rows = useMemo(() => (list ?? []).map((n) => ({ n, p: position(n) })), [list]);
  const shown = rows.filter(({ n }) => tab === "all" || (tab === "open") === (n.status === "open"));
  if (!list) return null;
  const open = rows.filter(({ n }) => n.status === "open");
  const agreed = rows.filter(({ n }) => n.status === "accepted");
  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Offers</h1>
          <p className="mt-1 text-sm text-muted">Every offer and counter-offer, per plot and per broker or owner.</p>
        </div>
        <Can area="offers"><Link href="/dashboard/offers/new" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90">New negotiation</Link></Can>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <Kpi k="Open negotiations" v={open.length} />
        <Kpi k="Your move" v={open.filter(({ p }) => p.turn === "us" || p.turn === "lapsed").length} sub="they replied, or your offer lapsed" />
        <Kpi k="Waiting on them" v={open.filter(({ p }) => p.turn === "them").length} />
        <Kpi k="Agreed" v={agreed.length} sub={agreed.length ? money(agreed.reduce((s, { n }) => s + n.agreed_pkr, 0)) + " in total" : ""} />
      </div>

      <section className="border-t border-line pt-5">
        <div className="mb-4 flex gap-1 text-sm">
          {([["open", "Open"], ["closed", "Closed"], ["all", "All"]] as const).map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`rounded-md px-3 py-1.5 ${tab === k ? "bg-line text-ink" : "text-muted hover:text-ink"}`}>{t}</button>
          ))}
        </div>
        {shown.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Plot</th><th className="pb-2 text-right font-normal">Our latest</th><th className="pb-2 text-right font-normal">Their latest</th><th className="pb-2 text-right font-normal">Gap</th><th className="pb-2 pl-6 text-left font-normal">Status</th><th className="pb-2 text-right font-normal">Last move</th></tr></thead>
            <tbody>{shown.map(({ n, p }) => (
              <tr key={n.id} className="border-t border-line hover:bg-line/30">
                <td className="py-3"><Link href={`/dashboard/offers/${n.id}`} className="font-medium">{n.plot_label}</Link><p className="text-xs text-muted">{n.counterparty} · {p.live.length} round{p.live.length === 1 ? "" : "s"}</p></td>
                <td className="text-right">{p.ours ? money(p.ours.amount_pkr) : <span className="text-muted">-</span>}</td>
                <td className="text-right">{p.theirs ? money(p.theirs.amount_pkr) : <span className="text-muted">-</span>}</td>
                <td className="text-right">{p.gap != null && p.theirs ? <>{money(p.gap)}<span className="ml-1.5 text-xs text-muted">{Math.round((p.gap / p.theirs.amount_pkr) * 100)}%</span></> : <span className="text-muted">-</span>}</td>
                <td className="pl-6">{n.status === "open" ? (p.turn ? <Badge tone={TURN[p.turn].tone}>{TURN[p.turn].label}</Badge> : <Badge tone="info">Open</Badge>)
                  : <Badge tone={STATUS_TONE[n.status]}>{cap(n.status)}{n.status === "accepted" && ` at ${money(n.agreed_pkr)}`}</Badge>}</td>
                <td className="text-right text-muted">{dayStr(n.status === "open" ? p.activity : n.closed_on)}</td>
              </tr>))}</tbody>
          </table>
        ) : <p className="text-sm text-muted">{list.length ? "Nothing in this view." : "No negotiations yet. Start one when a broker or owner names a price."}</p>}
      </section>
    </div>
  );
}
