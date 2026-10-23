"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { money, today } from "@/lib/offers";
import { label } from "@/lib/plots";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;

export default function NewNegotiation() {
  const router = useRouter();
  const [plots, setPlots] = useState<any[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [plotId, setPlotId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    get("/plots").then((p) => { setPlots(p); setPlotId(new URLSearchParams(location.search).get("plot") ?? String(p[0]?.id ?? "")); });
    get("/contacts").then((c) => setNames(c.filter((x: any) => x.roles.some((r: string) => r === "broker" || r === "owner")).map((x: any) => x.name)));
  }, []);
  const plot = plots.find((p) => String(p.id) === plotId);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const err: Errors = {};
    if (!plotId) err.plot = "Choose a plot";
    if (!f.counterparty.trim()) err.counterparty = "Who are you negotiating with?";
    if (!(Number(f.amount_pkr) > 0)) err.amount_pkr = "Enter an amount above zero";
    if (!f.made_on) err.made_on = "Enter the date"; else if (f.made_on > today()) err.made_on = "Date can't be in the future";
    if (f.valid_until && f.made_on && f.valid_until < f.made_on) err.valid_until = "Must be on or after the date made";
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      const r = await post(`/plots/${plotId}/negotiations`, { counterparty: f.counterparty, side: f.side, amount_pkr: Number(f.amount_pkr), made_on: f.made_on, valid_until: f.valid_until || null, terms: f.terms });
      router.push(`/dashboard/offers/${r.id}`);
    } catch (x) { setBusy(false); setErrors({ form: (x as Error).message || "Could not save" }); }
  };

  return (
    <div className="max-w-xl">
      <Link href="/dashboard/offers" className="text-sm text-muted hover:text-ink">← Offers</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">New negotiation</h1>
      <p className="mt-1 text-sm text-muted">Record the first price on the table. Add each counter-offer afterwards.</p>
      <form onSubmit={submit} noValidate className="mt-8 grid gap-5">
        <div>
          <Lbl>Plot</Lbl>
          <Select label="Plot" value={plotId} onChange={setPlotId} options={plots.map((p) => ({ value: String(p.id), label: label(p) }))} />
          {errors.plot && <p role="alert" className="mt-1.5 text-xs text-red-500">{errors.plot}</p>}
          {plot?.price && <p className="mt-1.5 text-xs text-muted">The computed price for this plot is {money(plot.price)}.</p>}
        </div>
        <div>
          <Lbl>Negotiating with</Lbl>
          <Field name="counterparty" list="people" placeholder="Broker or owner" error={errors.counterparty} autoComplete="off" />
          <datalist id="people">{names.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><Lbl>Whose price is this</Lbl><Select name="side" label="Whose price" defaultValue="theirs" options={[{ value: "theirs", label: "Theirs (they named it)" }, { value: "ours", label: "Ours (we offered it)" }]} /></div>
          <div><Lbl>Amount (PKR)</Lbl><Field name="amount_pkr" type="number" error={errors.amount_pkr} /></div>
          <div><Lbl>Date</Lbl><Field name="made_on" type="date" defaultValue={today()} max={today()} error={errors.made_on} /></div>
          <div><Lbl>Valid until (optional)</Lbl><Field name="valid_until" type="date" error={errors.valid_until} /></div>
        </div>
        <div><Lbl>Terms and inclusions (optional)</Lbl><Textarea name="terms" rows={2} placeholder="Taxes, possession date, what's included" /></div>
        <div className="flex items-center gap-2 pt-2">
          <Button disabled={busy}>Start negotiation</Button>
          <Link href="/dashboard/offers" className="rounded-lg bg-line/50 px-4 py-2.5 text-sm font-medium hover:bg-line">Cancel</Link>
        </div>
        {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}
      </form>
    </div>
  );
}
