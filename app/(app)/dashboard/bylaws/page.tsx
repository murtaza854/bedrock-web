"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { get, post } from "@/lib/api";
import { USES, band, dayOf, n, setbacks, status } from "@/lib/bylaws";
import { cap } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/can";

const Kpi = ({ k, v, sub }: { k: string; v: number; sub?: string }) => (
  <div><p className="text-xs text-muted">{k}</p><p className="mt-1.5 text-3xl font-light tracking-tight">{v}</p><p className="mt-1 min-h-4 text-xs text-muted">{sub}</p></div>
);
const ST: Record<string, { label: string; tone: string }> = { current: { label: "In force", tone: "good" }, future: { label: "Not yet in force", tone: "info" }, superseded: { label: "Superseded", tone: "neutral" }, void: { label: "Voided", tone: "bad" } };

export default function Bylaws() {
  const [rules, setRules] = useState<any[] | null>(null);
  const [cov, setCov] = useState<any[]>([]);
  const [history, setHistory] = useState(false);
  const [voiding, setVoiding] = useState<number | null>(null);
  const [voidErr, setVoidErr] = useState("");
  const load = () => { get("/bylaws").then(setRules); get("/bylaws/coverage").then(setCov); };
  useEffect(load, []);
  const rows = useMemo(() => (rules ?? []).map((r) => ({ r, st: status(r, rules ?? []) })), [rules]);
  if (!rules) return null;
  const inForce = rows.filter((x) => x.st === "current"), shown = rows.filter((x) => history || x.st === "current" || x.st === "future");
  const missing = cov.filter((p) => !p.matched);
  const verify = async (id: number) => { await post(`/bylaws/${id}/verify`, {}); load(); };
  const voidRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    if (!reason) return setVoidErr("Say why");
    try { await post(`/bylaws/${voiding}/void`, { reason }); } catch { return setVoidErr("Could not void"); }
    setVoiding(null); load();
  };
  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bylaws</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">The building limits that decide how much you can build on a plot. Nothing is pre-filled: enter each rule from the authority's circular, with its source, and confirm it with the authority before relying on it.</p>
        </div>
        <Can area="bylaws"><Link href="/dashboard/bylaws/new" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90">Add a rule</Link></Can>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <Kpi k="Rules in force" v={inForce.length} />
        <Kpi k="Confirmed with the authority" v={inForce.filter((x) => x.r.verified).length} sub={`${inForce.filter((x) => !x.r.verified).length} not confirmed yet`} />
        <Kpi k="Plots with a rule" v={cov.length - missing.length} sub={`of ${cov.length} active plots`} />
        <Kpi k="Plots with no rule" v={missing.length} sub="buildable area is unknown" />
      </div>

      {missing.length > 0 && (
        <section className="border-t border-line pt-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Plots with no matching rule</h2>
          <ul className="mt-4 text-sm">
            {missing.map((p) => (
              <li key={p.plot_id} className="flex items-center justify-between gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <Link href={`/dashboard/plots/${p.plot_id}`} className="font-medium">{p.plot_label}</Link>
                <span className="flex items-center gap-4 text-muted">{p.size_sqyd ? `${p.size_sqyd} sq yd` : "no size"} · {p.use}
                  <Can area="bylaws"><Link href={`/dashboard/bylaws/new?area=${encodeURIComponent(p.area)}&use=${p.use}`} className="text-xs hover:text-ink">Add a rule →</Link></Can></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-line pt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Rules<span className="ml-3 normal-case tracking-normal">{shown.length}</span></h2>
          <button onClick={() => setHistory(!history)} className="text-sm text-muted hover:text-ink">{history ? "Hide history" : "Show history"}</button>
        </div>
        {shown.length ? (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Area and use</th><th className="pb-2 text-left font-normal">Plot size</th><th className="pb-2 text-right font-normal">FAR</th><th className="pb-2 text-right font-normal">Coverage</th><th className="pb-2 text-right font-normal">Floors / height</th><th className="pb-2 text-right font-normal" title="front / rear / side">Setbacks</th><th className="pb-2 pl-6 text-left font-normal">Source</th><th className="pb-2 pl-6 text-left font-normal">Status</th><th /></tr></thead>
            <tbody>{shown.map(({ r, st }) => (
              <tr key={r.id} className={`border-t border-line align-top ${st === "void" || st === "superseded" ? "opacity-50" : ""}`}>
                <td className="py-3"><span className="font-medium">{r.area}</span><p className="text-xs text-muted">{cap(r.use_type)} · from {dayOf(r.effective_from)}</p></td>
                <td className="text-muted">{band(r)}</td>
                <td className="text-right">{n(r.far)}</td><td className="text-right">{n(r.max_coverage_pct, "%")}</td>
                <td className="text-right">{[r.max_floors != null && `${r.max_floors} floors`, r.max_height_ft != null && `${r.max_height_ft} ft`].filter(Boolean).join(" · ") || "-"}</td>
                <td className="text-right text-muted">{setbacks(r)}</td>
                <td className="pl-6 text-muted">{r.source}{r.notes && <p className="text-xs">{r.notes}</p>}{r.void_reason && <p className="text-xs">Voided: {r.void_reason}</p>}</td>
                <td className="pl-6"><span className="flex flex-wrap gap-1.5"><Badge tone={ST[st].tone}>{ST[st].label}</Badge>{st !== "void" && <Badge tone={r.verified ? "good" : "warn"}>{r.verified ? `Confirmed ${dayOf(r.verified_on)}` : "Not confirmed"}</Badge>}</span></td>
                <td className="pl-4 text-right text-xs">
                  {st !== "void" && (voiding === r.id ? (
                    <form onSubmit={voidRule} noValidate className="flex items-center justify-end gap-2"><div><Input name="reason" placeholder="Reason" aria-invalid={!!voidErr} className="!py-1 text-xs" autoFocus />{voidErr && <p role="alert" className="mt-1 text-red-500">{voidErr}</p>}</div><button className="text-red-500">Void</button><button type="button" onClick={() => setVoiding(null)} className="text-muted">Keep</button></form>
                  ) : <span className="flex justify-end gap-3 text-muted"><Can area="bylaws" letter="u">{!r.verified && <button onClick={() => verify(r.id)} className="hover:text-ink">Mark confirmed</button>}<button onClick={() => { setVoidErr(""); setVoiding(r.id); }} className="hover:text-ink">Void</button></Can></span>)}
                </td>
              </tr>))}</tbody>
          </table>
        ) : <p className="mt-4 text-sm text-muted">No rules yet. Add the rule for your first area from the authority's circular.</p>}
        <p className="mt-6 max-w-2xl text-xs text-muted">A plot uses the rule in force today for its area and use, whose plot-size band contains its size, taking the latest effective date and then the narrowest band. A change in the rules is a new row, so past work keeps its history. Rule changes are tracked on the <Link href="/dashboard/legal" className="underline hover:text-ink">Legal</Link> page. Use types: {USES.map((u) => u.label.toLowerCase()).join(", ")}.</p>
      </section>
    </div>
  );
}
