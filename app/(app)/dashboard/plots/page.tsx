"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { get, patch, pkr } from "@/lib/api";
import { pct } from "@/lib/feasibility";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RejectDialog } from "@/components/reject-dialog";
import { PurchaseDialog } from "@/components/purchase-dialog";
import { DOT, STATUSES, label, ppsy } from "@/lib/plots";
import { useSettings } from "@/lib/settings";

type SortKey = "label" | "size" | "price" | "ppsy" | "n" | "spread" | "feas";
const val = (p: any, k: SortKey) => (k === "label" ? label(p) : k === "size" ? p.size_sqyd : k === "ppsy" ? ppsy(p) : k === "feas" ? p.feasibility?.margin_on_cost : p[k]);

export default function Plots() {
  const { spread_alert_pct: spreadAlert, default_profile } = useSettings();
  // a plot with no use of its own follows the default profile, the same fallback the scorecard uses
  const [profiles, setProfiles] = useState<any[]>([]);
  useEffect(() => { get("/score/profiles").then(setProfiles).catch(() => {}); }, []);
  const useOf = (p: any) => profiles.find((x) => x.id === (p.profile_id ?? default_profile ?? profiles[0]?.id))?.name ?? "";
  const [plots, setPlots] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [area, setArea] = useState("all");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "label", dir: 1 });
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [buying, setBuying] = useState<any | null>(null);
  const [msg, setMsg] = useState("");

  const load = () => get("/plots").then(setPlots);
  useEffect(() => { load(); }, []);

  const areas = useMemo(() => [...new Set((plots ?? []).map((p) => p.area))].sort(), [plots]);
  const count = (s: string) => (plots ?? []).filter((p) => s === "all" || p.status === s).length;
  const shown = useMemo(() => {
    const needle = q.toLowerCase();
    const rows = (plots ?? []).filter((p) =>
      (status === "all" || p.status === status) && (area === "all" || p.area === area) &&
      `${label(p)} ${p.street}`.toLowerCase().includes(needle));
    // nulls always last, whichever direction
    return rows.sort((a, b) => {
      const x = val(a, sort.k), y = val(b, sort.k);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y, undefined, { numeric: true }) : x - y) * sort.dir;
    });
  }, [plots, q, status, area, sort]);

  const th = (k: SortKey, text: string, right = true) => (
    <th className={`pb-3 text-xs font-normal text-muted ${right ? "pl-6 text-right" : "text-left"}`}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k && s.dir === 1 ? -1 : 1 }))} className="hover:text-ink">
        {text}{sort.k === k && (sort.dir === 1 ? " ↑" : " ↓")}
      </button>
    </th>
  );

  const changeStatus = async (p: any, s: string) => {
    if (s === "rejected") return setRejecting(p);
    if (s === "bought") return setBuying(p);
    setMsg("");
    try { await patch(`/plots/${p.id}`, { status: s }); } catch (x) { setMsg(`${label(p)}: ${(x as Error).message}`); }
    load();
  };

  if (!plots) return null;
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plots</h1>
          <p className="mt-1 text-sm text-muted">{plots.length} tracked</p>
        </div>
        <Link href="/dashboard/plots/new" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90">Add plot</Link>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Input className="max-w-64" placeholder="Search plot, sector, street" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select label="Area" variant="ghost" className="-ml-1" value={area} onChange={setArea}
          options={[{ value: "all", label: "All areas" }, ...areas.map((a) => ({ value: a, label: a }))]} />
        <div className="flex flex-wrap gap-1 text-sm">
          {["all", ...STATUSES].map((s) => (
            <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s}
              className={`rounded-md px-3 py-1.5 capitalize ${status === s ? "bg-line text-ink" : "text-muted hover:text-ink"}`}>
              {s} <span className="text-xs">{count(s)}</span>
            </button>
          ))}
        </div>
      </div>

      {msg && <p role="alert" className="mt-4 text-sm text-red-500">{msg}</p>}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {th("label", "Plot", false)}<th className="pb-3 pl-6 text-left text-xs font-normal text-muted">Use</th>{th("size", "Size")}{th("price", "Price")}{th("ppsy", "Per sq yd")}{th("n", "Quotes")}{th("spread", "Broker gap")}{th("feas", "Feasibility")}
            <th className="pb-3 pl-4 text-left text-xs font-normal text-muted">Status</th><th />
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id} className={`relative cursor-pointer border-b border-line hover:bg-line/30 ${p.status === "rejected" ? "opacity-50" : ""}`}>
              <td className="py-3">
                <Link href={`/dashboard/plots/${p.id}`} className="font-medium after:absolute after:inset-0">{label(p)}</Link>
                {p.street && <p className="text-xs text-muted">{p.street}</p>}
              </td>
              <td className="pl-6 text-muted">{useOf(p)}</td>
              <td className="pl-6 text-right">{p.size_sqyd ? `${p.size_sqyd} sq yd` : <span className="text-muted">-</span>}</td>
              <td className="pl-6 text-right">
                {p.price ? <>{pkr(p.price)}<p className="text-xs text-muted">{p.quote_type === "transacted" ? "bought for" : p.quote_type.replace("_", " ")}</p></> : <span className="text-muted">no quotes</span>}
              </td>
              <td className="pl-6 text-right">{ppsy(p) ? Math.round(ppsy(p)!).toLocaleString() : <span className="text-muted">-</span>}</td>
              <td className="pl-6 text-right">{p.n ?? 0}</td>
              <td className="pl-6 text-right">{p.spread != null && <Badge tone={p.spread >= spreadAlert / 100 ? "bad" : "neutral"}>{Math.round(p.spread * 100)}%</Badge>}</td>
              <td className="pl-6 text-right">{p.feasibility ? <>{pct(p.feasibility.margin_on_cost)}<p className="text-xs text-muted">{p.feasibility.name}</p></> : <span className="text-muted">-</span>}</td>
              <td className="relative pl-4">
                <Select label={`Status of ${label(p)}`} variant="ghost" value={p.status} onChange={(v) => changeStatus(p, v)}
                  options={STATUSES.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1), dot: DOT[v] }))} />
              </td>
              <td className="relative pl-4 text-right"><Link href={`/dashboard/plots/${p.id}/edit`} className="text-xs text-muted hover:text-ink">Edit</Link></td>
            </tr>
          ))}
          {!shown.length && (
            <tr><td colSpan={10} className="py-16 text-center text-muted">
              {plots.length ? "No plots match these filters." : "No plots yet. Add your first one."}
            </td></tr>
          )}
        </tbody>
      </table>

      <RejectDialog plot={rejecting} onClose={() => setRejecting(null)} onDone={load} />
      <PurchaseDialog plot={buying} onClose={() => setBuying(null)} onDone={load} />
    </>
  );
}
