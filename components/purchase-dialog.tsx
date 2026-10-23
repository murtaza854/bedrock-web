"use client";
import { useEffect, useRef, useState } from "react";
import { get, post } from "@/lib/api";
import { label } from "@/lib/plots";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";

const today = () => new Date().toLocaleDateString("en-CA");
const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;

// Recording a purchase is what makes a plot "bought": it needs the price you actually paid.
export function PurchaseDialog({ plot, onClose, onDone }: { plot: any | null; onClose: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [price, setPrice] = useState("");
  const [seller, setSeller] = useState("");
  const [note, setNote] = useState("");
  const touched = useRef({ price: false, seller: false });
  useEffect(() => {
    if (!plot) return void ref.current?.close();
    setErrors({}); setPrice(""); setSeller(""); setNote(""); touched.current = { price: false, seller: false };
    ref.current?.showModal();
    // Suggest the agreed price if there is an accepted offer, otherwise the plot's current price. The suggestion arrives a
    // moment after the dialog opens, so it only fills a field you have not touched: it never overwrites what you typed.
    let live = true;
    const suggest = (p: string, who: string, why: string) => {
      if (!live) return;
      if (!touched.current.price) setPrice(p);
      if (!touched.current.seller) setSeller(who);
      setNote(why);
    };
    const current = plot.price ? String(plot.price) : "";
    get(`/plots/${plot.id}/negotiations`).then((ns: any[]) => {
      const a = ns.find((n) => n.status === "accepted");
      if (a) suggest(String(a.agreed_pkr), a.counterparty, "Starting from the price you agreed in your accepted offer.");
      else suggest(current, "", current ? "Starting from the plot's current price. Change it to what you actually paid." : "");
    }).catch(() => suggest(current, "", ""));
    return () => { live = false; };
  }, [plot]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const err: Errors = {};
    if (!(Number(f.price_pkr) > 0)) err.price_pkr = "Enter the price you paid";
    if (!f.bought_on) err.bought_on = "Enter the purchase date"; else if (f.bought_on > today()) err.bought_on = "Date can't be in the future";
    setErrors(err);
    if (Object.keys(err).length) return;
    try { await post(`/plots/${plot.id}/purchase`, { price_pkr: Number(f.price_pkr), bought_on: f.bought_on, seller: f.seller, note: f.note }); }
    catch (x) { return setErrors({ form: (x as Error).message || "Could not save" }); }
    onClose(); onDone();
  };

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[26rem] max-w-full rounded-xl border border-line bg-bg p-6 text-ink backdrop:bg-black/30">
      {plot && (
        <form key={plot.id} onSubmit={submit} noValidate className="grid gap-4">
          <div><h2 className="text-lg font-semibold">Record the purchase</h2><p className="mt-1 text-sm text-muted">{label(plot)}</p></div>
          <div><Lbl>Price you paid (PKR)</Lbl><Field name="price_pkr" type="number" value={price} onChange={(e) => { touched.current.price = true; setPrice(e.target.value); }} error={errors.price_pkr} autoFocus />{note && <p className="mt-1.5 text-xs text-muted">{note}</p>}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><Lbl>Date bought</Lbl><Field name="bought_on" type="date" defaultValue={today()} max={today()} error={errors.bought_on} /></div>
            <div><Lbl>Bought from</Lbl><Field name="seller" value={seller} onChange={(e) => { touched.current.seller = true; setSeller(e.target.value); }} placeholder="Owner or seller" /></div>
          </div>
          <div><Lbl>Note (optional)</Lbl><Textarea name="note" rows={2} placeholder="How it was paid, what was included" /></div>
          <div className="flex gap-2"><Button>Record purchase</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
          {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}
        </form>
      )}
    </dialog>
  );
}
