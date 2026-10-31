"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get, patch, pkr, post } from "@/lib/api";
import { DOT, STATUSES, cap, label, ppsy } from "@/lib/plots";
import { Badge, levelTone } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ClaimForm, LEVELS, QuoteForm } from "@/components/quote-claim-forms";
import { FilesSection, PlotFile, fileUrl } from "@/components/files";
import { RejectDialog } from "@/components/reject-dialog";
import { PurchaseDialog } from "@/components/purchase-dialog";
import { PurchaseSummary } from "@/components/purchase-summary";
import { BuildableSummary } from "@/components/buildable-summary";
import { ScoreSummary } from "@/components/score-summary";
import { OfferSummary } from "@/components/offer-summary";
import { TaskSummary } from "@/components/task-summary";
import { FinancialSummary } from "@/components/financial-summary";
import { LocationSummary } from "@/components/location-summary";
import { can, useMe } from "@/lib/auth";
import { useSettings } from "@/lib/settings";

const fmt = (n: number) => Math.round(n).toLocaleString();
const day = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Section({ title, note, action, children }: { title: string; note?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}{note && <span className="ml-3 normal-case tracking-normal">{note}</span>}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const Fact = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div><p className="text-xs text-muted">{k}</p><p className="mt-1.5 text-3xl font-light tracking-tight">{v}</p></div>
);
const Sub = ({ children }: { children: React.ReactNode }) => <p className="mt-1 text-xs text-muted">{children}</p>;
const Add = ({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="text-sm text-muted hover:text-ink">{open ? "Cancel" : `+ ${children}`}</button>
);

export default function Plot({ params }: { params: Promise<{ id: string }> }) {
  const { min_sample: MIN_N, spread_alert_pct: spreadAlert } = useSettings();
  const { id } = use(params);
  const me = useMe();
  const offers = can(me, "offers"); // each part of this page belongs to a tab, and shows only if the role can read it
  const [d, setD] = useState<any>(null);
  const [all, setAll] = useState<any[]>([]);
  const [form, setForm] = useState<"quote" | "claim" | null>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [buying, setBuying] = useState<any>(null);
  const [statusErr, setStatusErr] = useState("");
  const [files, setFiles] = useState<PlotFile[]>([]);
  const loadFiles = () => get(`/plots/${id}/files`).then(setFiles).catch(() => {});
  const load = () => get(`/plots/${id}`).then(setD);
  useEffect(() => { load(); get("/plots").then(setAll); loadFiles(); }, [id]);
  // arriving from an accepted offer: /plots/1?buy=1 opens the purchase form
  useEffect(() => { if (d && can(me, "offers", "c") && new URLSearchParams(location.search).get("buy") === "1" && d.plot.status !== "bought") setBuying(d.plot); }, [d?.plot?.id, me?.role]);

  const toggle = (k: "quote" | "claim") => setForm(form === k ? null : k);
  const changeStatus = async (s: string) => {
    if (s === "rejected") return setRejecting(d.plot);
    if (s === "bought") return setBuying(d.plot);
    setStatusErr("");
    try { await patch(`/plots/${id}`, { status: s }); } catch (x) { setStatusErr((x as Error).message); }
    load();
  };

  if (!d) return null;
  const { plot: p, quotes, claims, events } = d;

  // area median price per sq yd, from other priced plots in the same area
  const peers = all.filter((x) => x.area === p.area && ppsy(x)).map((x) => ppsy(x)!).sort((a, b) => a - b);
  const mid = peers.length ? (peers[Math.floor((peers.length - 1) / 2)] + peers[Math.ceil((peers.length - 1) / 2)]) / 2 : null;
  const mine = ppsy(p);
  const vsArea = mine && mid && peers.length >= MIN_N ? mine / mid - 1 : null;

  // best-supported claim per field: strongest verification, then newest. Differing values are a conflict.
  const groups = Object.values<any[]>(claims.reduce((m: any, c: any) => { (m[c.field.toLowerCase()] ??= []).push(c); return m; }, {}))
    .map((g) => {
      const sorted = [...g].sort((a, b) => LEVELS.indexOf(b.verification) - LEVELS.indexOf(a.verification) || +new Date(b.created_at) - +new Date(a.created_at));
      return { best: sorted[0], rest: sorted.slice(1), conflict: new Set(g.map((c) => c.value.trim().toLowerCase())).size > 1 };
    }).sort((a, b) => a.best.field.localeCompare(b.best.field));

  const lo = quotes.length ? Math.min(...quotes.map((q: any) => q.price_pkr)) : 0;
  const hi = quotes.length ? Math.max(...quotes.map((q: any) => q.price_pkr)) : 0;

  return (
    <div className="grid gap-10">
      <div>
        <Link href="/dashboard/plots" className="text-sm text-muted hover:text-ink">← Plots</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{label(p)}</h1>
            <p className="mt-1 text-sm text-muted">
              {[p.street, p.size_sqyd && `${p.size_sqyd} sq yd`, p.corner != null && (p.corner ? "Corner" : "Not a corner")].filter(Boolean).join(" · ") || "No details yet"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select label="Status" variant="ghost" value={p.status} onChange={changeStatus}
              options={STATUSES.map((v) => ({ value: v, label: cap(v), dot: DOT[v] }))} />
            {statusErr && <span role="alert" className="max-w-xs text-xs text-red-500">{statusErr}</span>}
            <Link href={`/dashboard/plots/${id}/report`} className="rounded-lg bg-line/50 px-3.5 py-2 text-sm font-medium hover:bg-line">Report</Link>
            <Link href={`/dashboard/plots/${id}/edit`} className="rounded-lg bg-line/50 px-3.5 py-2 text-sm font-medium hover:bg-line">Edit</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <Fact k={p.quote_type === "transacted" ? "Bought for" : "Price"} v={p.price ? pkr(p.price).replace("PKR ", "") : "-"} />
        <Fact k="Per sq yd" v={mine ? fmt(mine) : "-"} />
        <Fact k="Quotes" v={p.n ?? 0} />
        <Fact k="Broker gap" v={p.spread != null ? `${Math.round(p.spread * 100)}%` : "-"} />
        <div className="col-span-2 -mt-4 text-xs text-muted md:col-span-4">
          {p.price ? <>{p.quote_type === "transacted" ? <>The price you paid. </> : <>Computed from the strongest quote type: <b className="font-medium text-ink">{cap(p.quote_type)}</b>. </>}</> : "No quotes yet. "}
          {p.spread >= spreadAlert / 100 && <span className="text-red-500">Brokers differ by {Math.round(p.spread * 100)}% ({pkr(lo)} to {pkr(hi)}). </span>}
          {vsArea != null ? <>{Math.abs(vsArea) < 0.005 ? "In line with" : `${Math.round(Math.abs(vsArea) * 100)}% ${vsArea > 0 ? "above" : "below"}`} the {p.area} median ({fmt(mid!)} per sq yd, {peers.length} plots).</>
            : mine ? `Not enough priced plots in ${p.area} to compare yet (${peers.length} of ${MIN_N}).` : p.size_sqyd ? "" : "Add a size to see price per sq yd."}
        </div>
      </div>

      {offers && <PurchaseSummary plot={p} onChange={load} />}

      <Section title="Quotes" note={`${quotes.length}`} action={<Add open={form === "quote"} onClick={() => toggle("quote")}>Add quote</Add>}>
        {form === "quote" && <div className="mb-6"><QuoteForm plotId={id} onSaved={() => { setForm(null); load(); }} /></div>}
        {quotes.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-xs font-normal text-muted"><th className="pb-2 text-left font-normal">Broker</th><th className="pb-2 text-left font-normal">Type</th><th className="pb-2 text-right font-normal">Price</th><th className="pb-2 text-right font-normal">Per sq yd</th><th className="pb-2 pl-6 text-left font-normal">Inclusions</th><th className="pb-2 text-right font-normal">Date</th></tr></thead>
            <tbody>{quotes.map((q: any) => (
              <tr key={q.id} className="border-t border-line">
                <td className="py-2.5 font-medium">{q.broker}</td>
                <td><Badge>{cap(q.quote_type)}</Badge></td>
                <td className="text-right">{pkr(q.price_pkr)}</td>
                <td className="text-right text-muted">{p.size_sqyd ? fmt(q.price_pkr / p.size_sqyd) : "-"}</td>
                <td className="pl-6 text-muted">{q.inclusions || "-"}</td>
                <td className="text-right text-muted">{day(q.created_at)}</td>
              </tr>))}</tbody>
          </table>
        ) : <p className="text-sm text-muted">No quotes yet. Add the first broker quote.</p>}
      </Section>

      <Section title="Facts" note="best-supported claim per field" action={<Add open={form === "claim"} onClick={() => toggle("claim")}>Add claim</Add>}>
        {form === "claim" && <div className="mb-6"><ClaimForm plotId={id} onSaved={() => { setForm(null); load(); }} /></div>}
        {groups.length ? (
          <ul className="text-sm">
            {groups.map((g) => (
              <li key={g.best.field} className="border-t border-line py-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-4">
                  <span><span className="text-muted">{cap(g.best.field)}</span> <b className="ml-3 font-medium">{g.best.value}</b></span>
                  <span className="flex items-center gap-2">
                    {g.conflict && <Badge tone="bad">Conflict</Badge>}
                    <Badge tone={levelTone[g.best.verification]}>{cap(g.best.verification)}</Badge>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{g.best.source || "No source"} · {day(g.best.created_at)}{files.find((x) => x.id === g.best.file_id) && <> · <a href={fileUrl(g.best.file_id)} target="_blank" rel="noreferrer" className="underline hover:text-ink">{files.find((x) => x.id === g.best.file_id)!.label}</a></>}</p>
                {g.rest.map((c: any) => (
                  <p key={c.id} className="mt-1 text-xs text-muted">Also: {c.value} ({cap(c.verification).toLowerCase()}, {c.source || "no source"}, {day(c.created_at)})</p>
                ))}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No claims yet. Record what you know and where it came from.</p>}
      </Section>

      <FilesSection plotId={id} files={files} canAdd={can(me, "plots", "c")} canDelete={can(me, "plots", "d")} onChange={() => { loadFiles(); load(); }} />

      <LocationSummary plot={p} />

      {can(me, "scorecard") && <ScoreSummary plotId={id} />}

      {can(me, "bylaws") && <BuildableSummary plotId={id} />}

      {can(me, "feasibility") && <FinancialSummary plotId={id} bought={p.status === "bought"} />}

      {can(me, "tasks") && <TaskSummary plotId={id} />}

      {offers && <OfferSummary plotId={id} />}


      <Section title="History">
        <ul className="grid gap-2 text-sm">
          {events.map((e: any) => (
            <li key={e.id} className="flex gap-4"><span className="w-28 shrink-0 text-muted">{day(e.created_at)}</span><span>{cap(e.status)}{e.reason && <span className="text-muted"> · {e.reason}</span>}</span></li>
          ))}
          <li className="flex gap-4"><span className="w-28 shrink-0 text-muted">{day(p.created_at)}</span><span>Added</span></li>
        </ul>
      </Section>

      <RejectDialog plot={rejecting} onClose={() => setRejecting(null)} onDone={load} />
      <PurchaseDialog plot={buying} onClose={() => setBuying(null)} onDone={load} />
    </div>
  );
}
