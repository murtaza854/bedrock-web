"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { STATUS_TONE, TURN, dayStr, money, position, today } from "@/lib/offers";
import { cap } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;
const Fact = ({ k, v, sub }: { k: string; v: React.ReactNode; sub?: React.ReactNode }) => (
  <div><p className="text-xs text-muted">{k}</p><p className="mt-1.5 text-2xl font-light tracking-tight">{v}</p><p className="mt-1 min-h-4 text-xs text-muted">{sub}</p></div>
);

// Ours and theirs, round by round, so you can see the two sides closing in.
function Chart({ live }: { live: any[] }) {
  const W = 600, H = 150, P = 14;
  const vals = live.map((r) => r.amount_pkr), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => P + (live.length === 1 ? 0 : (i / (live.length - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const line = (side: string) => live.map((r, i) => (r.side === side ? `${x(i)},${y(r.amount_pkr)}` : null)).filter(Boolean).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Offer amounts by round, ours and theirs">
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="var(--line)" /><line x1={P} x2={W - P} y1={P} y2={P} stroke="var(--line)" strokeDasharray="3 4" />
        {(["theirs", "ours"] as const).map((s) => line(s).includes(" ") && <polyline key={s} points={line(s)} fill="none" stroke={s === "ours" ? "var(--accent)" : "var(--muted)"} strokeWidth="2" strokeLinejoin="round" />)}
        {live.map((r, i) => <circle key={r.id} cx={x(i)} cy={y(r.amount_pkr)} r="4" fill={r.side === "ours" ? "var(--accent)" : "var(--muted)"}><title>{`${r.side === "ours" ? "Ours" : "Theirs"}: ${money(r.amount_pkr)}`}</title></circle>)}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-muted"><span>{money(hi)} at the top</span><span className="flex gap-4"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-accent" />Ours</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-muted" />Theirs</span></span><span>{money(lo)} at the bottom</span></figcaption>
    </figure>
  );
}

export default function Negotiation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [n, setN] = useState<any>(null);
  const [form, setForm] = useState<"round" | "close" | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [outcome, setOutcome] = useState("accepted");
  const [voiding, setVoiding] = useState<number | null>(null);
  const [voidErr, setVoidErr] = useState("");
  const load = () => get(`/negotiations/${id}`).then(setN);
  useEffect(() => { load(); }, [id]);

  const addRound = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const err: Errors = {};
    if (!(Number(f.amount_pkr) > 0)) err.amount_pkr = "Enter an amount above zero";
    if (!f.made_on) err.made_on = "Enter the date"; else if (f.made_on > today()) err.made_on = "Date can't be in the future";
    if (f.valid_until && f.made_on && f.valid_until < f.made_on) err.valid_until = "Must be on or after the date made";
    setErrors(err);
    if (Object.keys(err).length) return;
    try { await post(`/negotiations/${id}/rounds`, { side: f.side, amount_pkr: Number(f.amount_pkr), made_on: f.made_on, valid_until: f.valid_until || null, terms: f.terms }); }
    catch (x) { return setErrors({ form: (x as Error).message || "Could not save" }); }
    setForm(null); load();
  };
  const close = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (outcome === "accepted" && !(Number(f.agreed_pkr) > 0)) return setErrors({ agreed_pkr: "Enter the agreed price" });
    try { await post(`/negotiations/${id}/close`, { status: outcome, agreed_pkr: outcome === "accepted" ? Number(f.agreed_pkr) : null, note: f.note }); }
    catch (x) { return setErrors({ form: (x as Error).message || "Could not close" }); }
    setForm(null); load();
  };
  const voidRound = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    if (!reason) return setVoidErr("Say why");
    try { await post(`/rounds/${voiding}/void`, { reason }); } catch { return setVoidErr("Could not void"); }
    setVoiding(null); load();
  };
  const reopen = async () => { try { await post(`/negotiations/${id}/reopen`, {}); load(); } catch (x) { setErrors({ form: (x as Error).message }); } };

  if (!n) return null;
  const p = position(n), open = n.status === "open";
  const last = p.last;
  // change against the previous live round from the same side
  const change = (r: any) => { const prev = [...p.live].slice(0, p.live.indexOf(r)).reverse().find((x) => x.side === r.side); return prev ? r.amount_pkr - prev.amount_pkr : null; };
  const vsPrice = p.ours && n.computed_price ? p.ours.amount_pkr / n.computed_price - 1 : null;

  return (
    <div className="grid gap-10">
      <div>
        <Link href="/dashboard/offers" className="text-sm text-muted hover:text-ink">← Offers</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight"><Link href={`/dashboard/plots/${n.plot_id}`}>{n.plot_label}</Link></h1>
            <p className="mt-1 text-sm text-muted">Negotiating with {n.counterparty}</p>
          </div>
          <span className="flex items-center gap-2">
            {open && p.turn && <Badge tone={TURN[p.turn].tone}>{TURN[p.turn].label}</Badge>}
            <Badge tone={STATUS_TONE[n.status]}>{open ? "Open" : cap(n.status)}</Badge>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <Fact k="Our latest offer" v={p.ours ? money(p.ours.amount_pkr).replace("PKR ", "") : "-"} sub={vsPrice != null ? `${Math.abs(Math.round(vsPrice * 100))}% ${vsPrice <= 0 ? "below" : "above"} the computed price` : ""} />
        <Fact k="Their latest" v={p.theirs ? money(p.theirs.amount_pkr).replace("PKR ", "") : "-"} sub={p.theirs && n.computed_price ? `${Math.round((p.theirs.amount_pkr / n.computed_price - 1) * 100)}% against the computed price` : ""} />
        <Fact k="Gap" v={p.gap != null ? money(p.gap).replace("PKR ", "") : "-"} sub={p.gap != null && p.theirs ? `${Math.round((p.gap / p.theirs.amount_pkr) * 100)}% of their price` : "Needs an offer from each side"} />
        <Fact k="Computed price" v={n.computed_price ? money(n.computed_price).replace("PKR ", "") : "-"} sub="from your quotes" />
      </div>

      {!open && (
        <div className="rounded-xl bg-line/40 px-5 py-4 text-sm">
          <b className="font-medium">{cap(n.status)}{n.status === "accepted" && ` at ${money(n.agreed_pkr)}`}</b> on {dayStr(n.closed_on)}.{n.close_note && <span className="text-muted"> {n.close_note}</span>}
          {n.status === "accepted" && <Link href={`/dashboard/plots/${n.plot_id}?buy=1`} className="ml-4 underline hover:text-muted">Record the purchase</Link>}
          <button onClick={reopen} className="ml-4 text-muted underline hover:text-ink">Reopen</button>
          {errors.form && <p role="alert" className="mt-2 text-red-500">{errors.form}</p>}
        </div>
      )}

      {p.live.length >= 2 && <section className="border-t border-line pt-5"><h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted">How the two sides moved</h2><Chart live={p.live} /></section>}

      <section className="border-t border-line pt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Rounds<span className="ml-3 normal-case tracking-normal">{p.live.length}</span></h2>
          {open && <span className="flex gap-5 text-sm"><button onClick={() => { setErrors({}); setForm(form === "round" ? null : "round"); }} className="text-muted hover:text-ink">{form === "round" ? "Cancel" : "+ Add a round"}</button>
            <button onClick={() => { setErrors({}); setOutcome("accepted"); setForm(form === "close" ? null : "close"); }} className="text-muted hover:text-ink">{form === "close" ? "Cancel" : "Close negotiation"}</button></span>}
        </div>
        {form === "round" && (
          <form key={last?.id} onSubmit={addRound} noValidate className="mt-4 grid items-start gap-4 md:grid-cols-4">
            <div><Lbl>Whose offer</Lbl><Select name="side" label="Whose offer" defaultValue={last?.side === "ours" ? "theirs" : "ours"} options={[{ value: "theirs", label: "Their counter" }, { value: "ours", label: "Our offer" }]} /></div>
            <div><Lbl>Amount (PKR)</Lbl><Field name="amount_pkr" type="number" error={errors.amount_pkr} autoFocus /></div>
            <div><Lbl>Date</Lbl><Field name="made_on" type="date" defaultValue={today()} max={today()} error={errors.made_on} /></div>
            <div><Lbl>Valid until (optional)</Lbl><Field name="valid_until" type="date" error={errors.valid_until} /></div>
            <div className="md:col-span-4"><Lbl>Terms (optional)</Lbl><Field name="terms" placeholder="What changed besides the price" /></div>
            <div className="flex items-center gap-3 md:col-span-4"><Button>Save round</Button>{errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}</div>
          </form>
        )}
        {form === "close" && (
          <form onSubmit={close} noValidate className="mt-4 grid items-start gap-4 md:grid-cols-3">
            <div><Lbl>How it ended</Lbl><Select label="Outcome" value={outcome} onChange={setOutcome} options={["accepted", "rejected", "withdrawn", "expired"].map((x) => ({ value: x, label: cap(x) }))} /></div>
            {outcome === "accepted" && <div><Lbl>Agreed price (PKR)</Lbl><Field name="agreed_pkr" type="number" defaultValue={last ? String(last.amount_pkr) : ""} error={errors.agreed_pkr} /></div>}
            <div className={outcome === "accepted" ? "" : "md:col-span-2"}><Lbl>Note (optional)</Lbl><Textarea name="note" rows={1} /></div>
            <div className="flex items-center gap-3 md:col-span-3"><Button>Close negotiation</Button>{errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}</div>
          </form>
        )}
        <table className="mt-5 w-full text-sm">
          <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Date</th><th className="pb-2 text-left font-normal">From</th><th className="pb-2 text-right font-normal">Amount</th><th className="pb-2 text-right font-normal">Moved</th><th className="pb-2 pl-6 text-left font-normal">Terms and validity</th><th /></tr></thead>
          <tbody>{n.rounds.map((r: any) => {
            const ch = r.voided_at ? null : change(r);
            const lapsed = open && !r.voided_at && r === last && r.valid_until && r.valid_until.slice(0, 10) < today();
            return (
              <tr key={r.id} className={`border-t border-line align-top ${r.voided_at ? "opacity-50" : ""}`}>
                <td className="py-3 text-muted">{dayStr(r.made_on)}</td>
                <td><Badge tone={r.side === "ours" ? "good" : "neutral"}>{r.side === "ours" ? "Our offer" : "Their counter"}</Badge></td>
                <td className={`text-right ${r.voided_at ? "line-through" : ""}`}>{money(r.amount_pkr)}</td>
                <td className="text-right text-muted">{ch == null ? "-" : ch === 0 ? "no change" : `${ch < 0 ? "-" : "+"}${Math.abs(ch).toLocaleString()}`}</td>
                <td className="pl-6 text-muted">{r.terms}{r.valid_until && <span className="block text-xs">Valid until {dayStr(r.valid_until)} {lapsed && <Badge tone="bad">Lapsed</Badge>}</span>}{r.voided_at && <span className="block text-xs">Voided: {r.void_reason}</span>}</td>
                <td className="pl-4 text-right text-xs">
                  {!r.voided_at && open && (voiding === r.id ? (
                    <form onSubmit={voidRound} noValidate className="flex items-center justify-end gap-2"><div><Input name="reason" placeholder="Reason" aria-invalid={!!voidErr} className="!py-1 text-xs" autoFocus />{voidErr && <p role="alert" className="mt-1 text-red-500">{voidErr}</p>}</div><button className="text-red-500">Void</button><button type="button" onClick={() => setVoiding(null)} className="text-muted">Keep</button></form>
                  ) : <button onClick={() => { setVoidErr(""); setVoiding(r.id); }} className="text-muted hover:text-ink">Void</button>)}
                </td>
              </tr>);
          })}</tbody>
        </table>
      </section>
    </div>
  );
}
