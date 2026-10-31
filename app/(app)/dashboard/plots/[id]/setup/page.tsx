"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get, pkr, post } from "@/lib/api";
import { label } from "@/lib/plots";
import { today } from "@/lib/offers";
import { can, useMe } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { StepBar } from "@/components/step-bar";
import { ClaimForm, QuoteForm } from "@/components/quote-claim-forms";

// The steps after "Add plot". Every step can be skipped; whatever is saved shows under the form so you can add several.
function Form({ plotId, onSaved, offer }: { plotId: string; onSaved: (s: string) => void; offer: boolean }) {
  const [errors, setErrors] = useState<Errors>({});
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const f = Object.fromEntries(new FormData(el)) as Record<string, string>;
    try {
      if (offer) {
        if (!f.counterparty.trim() || !(Number(f.amount_pkr) > 0)) return setErrors({ form: "Enter who you are negotiating with and an amount above zero" });
        await post(`/plots/${plotId}/negotiations`, { counterparty: f.counterparty, side: f.side, amount_pkr: Number(f.amount_pkr), made_on: today(), valid_until: null, terms: "" });
      } else {
        if (!f.title.trim()) return setErrors({ form: "Give the task a title" });
        await post("/tasks", { title: f.title, notes: "", due_on: f.due_on || null, priority: f.priority, plot_id: Number(plotId), party_id: null });
      }
    } catch (x) { return setErrors({ form: (x as Error).message || "Could not save" }); }
    setErrors({}); el.reset(); onSaved(offer ? `${f.counterparty}, ${pkr(Number(f.amount_pkr))}` : f.title);
  };
  return offer ? (
    <form onSubmit={submit} noValidate className="grid items-start gap-3 md:grid-cols-4">
      <Field name="counterparty" placeholder="Broker or owner" autoFocus />
      <Select name="side" label="Whose price" defaultValue="theirs" options={[{ value: "theirs", label: "Theirs" }, { value: "ours", label: "Ours" }]} />
      <Field name="amount_pkr" type="number" placeholder="Amount (PKR)" />
      <Button>Save offer</Button>
      {errors.form && <p role="alert" className="text-sm text-red-500 md:col-span-4">{errors.form}</p>}
    </form>
  ) : (
    <form onSubmit={submit} noValidate className="grid items-start gap-3 md:grid-cols-4">
      <Field name="title" placeholder="What needs doing?" autoFocus />
      <Field name="due_on" type="date" aria-label="Due" />
      <Select name="priority" label="Priority" defaultValue="normal" options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} />
      <Button>Save task</Button>
      {errors.form && <p role="alert" className="text-sm text-red-500 md:col-span-4">{errors.form}</p>}
    </form>
  );
}

export default function Setup({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const [plot, setPlot] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<string[][]>([[], [], [], []]);
  useEffect(() => { get(`/plots/${id}`).then((d) => setPlot(d.plot)); }, [id]);
  if (!plot || !me) return null;

  const add = (s: string) => setSaved((all) => all.map((l, i) => (i === step ? [...l, s] : l)));
  // each step is offered only if the role may create that kind of thing
  const steps = [
    { name: "Quotes", hint: "What brokers are asking for this plot.", body: <QuoteForm plotId={id} onSaved={(f) => add(`${f.broker}, ${pkr(f.price_pkr)}`)} /> },
    { name: "Facts", hint: "What you know about it, and where you heard it.", body: <ClaimForm plotId={id} onSaved={(f) => add(`${f.field}: ${f.value}`)} /> },
    ...(can(me, "tasks", "c") ? [{ name: "Tasks", hint: "Anything you need to do about this plot.", body: <Form plotId={id} offer={false} onSaved={add} /> }] : []),
    ...(can(me, "offers", "c") ? [{ name: "Offers", hint: "A price on the table, if a negotiation has started.", body: <Form plotId={id} offer onSaved={add} /> }] : []),
  ];
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted">Plot added: <b className="font-medium text-ink">{label(plot)}</b></p>
        <Link href="/dashboard/plots" className="text-sm text-muted hover:text-ink">Skip all</Link>
      </div>
      <div className="mt-6"><StepBar step={step + 1} total={steps.length + 1} /></div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{s.name}</h1>
      <p className="mt-1 text-sm text-muted">{s.hint} You can skip this and add it later from the plot page.</p>
      <div className="mt-6">{s.body}</div>
      {saved[step].length > 0 && <ul className="mt-5 text-sm">{saved[step].map((x, i) => <li key={i} className="border-t border-line py-2">Saved: {x}</li>)}</ul>}
      <div className="mt-8 flex items-center gap-2">
        {step > 0 && <button onClick={() => setStep(step - 1)} className="rounded-lg bg-line/50 px-4 py-2.5 text-sm font-medium hover:bg-line">Back</button>}
        {last ? <Link href={`/dashboard/plots/${id}`} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90">Finish</Link>
          : <button onClick={() => setStep(step + 1)} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90">{saved[step].length ? "Next" : "Skip"}</button>}
      </div>
    </div>
  );
}
