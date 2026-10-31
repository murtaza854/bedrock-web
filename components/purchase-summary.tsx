"use client";
import { useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/can";
import { Input } from "@/components/ui/input";

const money = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const day = (d: string) => new Date(d.slice(0, 10) + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const pct = (v: number) => `${Math.abs(v * 100).toFixed(1)}%`;

// What was paid, and how it compares with the asking price, the agreed price and the area.
export function PurchaseSummary({ plot, onChange }: { plot: any; onChange: () => void }) {
  const [u, setU] = useState<any>(undefined);
  const [comp, setComp] = useState<any>(null);
  const [voiding, setVoiding] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    get(`/plots/${plot.id}/purchase`).then(setU);
    get(`/plots/${plot.id}/comparables`).then(setComp).catch(() => {});
  }, [plot.id, plot.status]);
  if (!u) return null;

  const price: number = u.price_pkr;
  // the first asking price and the latest one can differ: brokers move their price. Show both when they do.
  const sameAsk = u.first_asking_pkr != null && u.first_asking_pkr === u.asking_pkr;
  const ask = (amount: number, at: string, broker: string, name: string) => {
    const v = price / amount - 1;
    return (
      <li key={name}>
        {v < 0 ? <><b className="font-medium">{pct(v)} below</b> the {name} of {money(amount)}</> : v > 0 ? <><b className="font-medium">{pct(v)} above</b> the {name} of {money(amount)}</> : <>The same as the {name} of {money(amount)}</>}
        {v < 0 && <span className="text-muted"> (saved {money(amount - price)})</span>}
        <span className="text-muted"> · {broker}, {day(at)}</span>
      </li>
    );
  };
  const ppsy = plot.size_sqyd ? price / plot.size_sqyd : null;
  const vsArea = ppsy && comp?.median && comp.n >= 1 ? ppsy / comp.median - 1 : null;
  const days = u.first_quote_at ? Math.round((new Date(u.bought_on).getTime() - new Date(u.first_quote_at).getTime()) / 86400000) : null;
  const doVoid = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    if (!reason) return setErr("Say why");
    try { await post(`/purchases/${u.id}/void`, { reason }); } catch { return setErr("Could not void"); }
    setVoiding(false); onChange();
  };

  return (
    <section className="border-t border-line pt-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Purchase</h2>
      <div className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-[auto_1fr]">
        <div>
          <p className="text-xs text-muted">Bought for</p>
          <p className="mt-1.5 text-3xl font-light tracking-tight">{money(price)}</p>
          <p className="mt-1 text-xs text-muted">{day(u.bought_on)}{u.seller && ` · from ${u.seller}`}</p>
        </div>
        <ul className="grid content-start gap-1.5 text-sm">
          {u.first_asking_pkr != null && (sameAsk ? ask(u.first_asking_pkr, u.first_asking_at, u.first_asking_broker, "asking price")
            : [ask(u.first_asking_pkr, u.first_asking_at, u.first_asking_broker, "first asking price"), ask(u.asking_pkr, u.asking_at, u.asking_broker, "latest asking price")])}
          {u.agreed_pkr != null && u.agreed_pkr !== price && <li className="text-muted">You agreed {money(u.agreed_pkr)} in your accepted offer, and paid {price > u.agreed_pkr ? `${money(price - u.agreed_pkr)} more` : `${money(u.agreed_pkr - price)} less`}.</li>}
          {vsArea != null && <li><b className="font-medium">{pct(vsArea)} {vsArea < 0 ? "below" : "above"}</b> the median of {comp.n} similar plot{comp.n === 1 ? "" : "s"} in the area ({Math.round(ppsy!).toLocaleString()} per sq yd against {Math.round(comp.median).toLocaleString()}).</li>}
          {days != null && days >= 0 && <li className="text-muted">{days === 0 ? "Bought the same day it was first quoted." : `${days} days from the first quote to buying.`}</li>}
          {u.note && <li className="text-muted">{u.note}</li>}
        </ul>
      </div>
      <Can area="offers" letter="u"><div className="mt-4 text-xs">
        {voiding ? (
          <form onSubmit={doVoid} noValidate className="flex max-w-md items-center gap-2"><div className="flex-1"><Input name="reason" placeholder="Why is this being voided?" aria-invalid={!!err} className="!py-1.5 text-xs" autoFocus />{err && <p role="alert" className="mt-1 text-red-500">{err}</p>}</div>
            <button className="text-red-500">Void purchase</button><button type="button" onClick={() => setVoiding(false)} className="text-muted">Keep</button></form>
        ) : <button onClick={() => { setErr(""); setVoiding(true); }} className="text-muted hover:text-ink">Void this purchase (entered by mistake)</button>}
      </div></Can>
    </section>
  );
}
