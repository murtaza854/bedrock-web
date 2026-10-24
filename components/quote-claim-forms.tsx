"use client";
import { useState } from "react";
import { post } from "@/lib/api";
import { cap } from "@/lib/plots";
import { Button } from "@/components/ui/button";
import { Errors, Field, required } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

const QUOTE_TYPES = ["asking", "negotiable", "owner_confirmed", "buyer_confirmed", "transacted"];
export const LEVELS = ["claimed", "ai_unverified", "site_verified", "document_verified", "authority_confirmed"]; // weakest to strongest

// The add-quote and add-claim forms, shared by the plot page and the add-plot wizard. onSaved gets what was posted.
function useSave(plotId: string | number, kind: "quote" | "claim", rules: Errors, onSaved: (f: any) => void) {
  const [errors, setErrors] = useState<Errors>({});
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const f: any = Object.fromEntries(new FormData(el));
    const err = required(f, rules);
    if (f.price_pkr && !(Number(f.price_pkr) > 0)) err.price_pkr = "Price must be above zero";
    setErrors(err);
    if (Object.keys(err).length) return;
    if (f.price_pkr) f.price_pkr = Number(f.price_pkr);
    try { await post(`/plots/${plotId}/${kind}s`, f); }
    catch { return setErrors({ form: "Could not save, try again" }); }
    el.reset(); onSaved(f);
  };
  return { errors, submit };
}

export function QuoteForm({ plotId, onSaved }: { plotId: string | number; onSaved: (f: any) => void }) {
  const { errors, submit } = useSave(plotId, "quote", { broker: "Enter the broker", price_pkr: "Enter a price" }, onSaved);
  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-3 md:grid-cols-5">
      <Field name="broker" placeholder="Broker" error={errors.broker} autoFocus />
      <Select name="quote_type" label="Quote type" defaultValue="asking" options={QUOTE_TYPES.map((t) => ({ value: t, label: cap(t) }))} />
      <Field name="price_pkr" type="number" placeholder="Price (PKR)" error={errors.price_pkr} />
      <Field name="inclusions" placeholder="Inclusions" />
      <Button>Save quote</Button>
      {errors.form && <p role="alert" className="text-sm text-red-500 md:col-span-5">{errors.form}</p>}
    </form>
  );
}

export function ClaimForm({ plotId, onSaved }: { plotId: string | number; onSaved: (f: any) => void }) {
  const { errors, submit } = useSave(plotId, "claim", { field: "Enter a field", value: "Enter a value" }, onSaved);
  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-3 md:grid-cols-5">
      <Field name="field" placeholder="Field (e.g. corner, title)" error={errors.field} autoFocus />
      <Field name="value" placeholder="Value" error={errors.value} />
      <Field name="source" placeholder="Source" />
      <Select name="verification" label="Verification level" defaultValue="claimed" options={LEVELS.slice(0, 1).concat(LEVELS.slice(2)).map((t) => ({ value: t, label: cap(t) }))} />
      <Button>Save claim</Button>
      {errors.form && <p role="alert" className="text-sm text-red-500 md:col-span-5">{errors.form}</p>}
    </form>
  );
}
