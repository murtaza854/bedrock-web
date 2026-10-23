"use client";
import { useEffect, useRef, useState } from "react";
import { patch } from "@/lib/api";
import { label } from "@/lib/plots";
import { Button } from "@/components/ui/button";
import { Errors } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";

// Rejecting needs a reason (the API enforces it too). `plot` null = closed.
export function RejectDialog({ plot, onClose, onDone }: { plot: any | null; onClose: () => void; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { if (plot) { setErrors({}); ref.current?.showModal(); } else ref.current?.close(); }, [plot]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    if (!reason) return setErrors({ reason: "Say why this plot is being rejected" });
    try { await patch(`/plots/${plot.id}`, { status: "rejected", reason }); }
    catch (x) { return setErrors({ form: (x as Error).message || "Could not save, try again" }); }
    onClose(); onDone();
  };

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-96 max-w-full rounded-xl border border-line bg-bg p-6 text-ink backdrop:bg-black/30">
      {plot && (
        <form onSubmit={submit} noValidate className="grid gap-3">
          <h2 className="text-lg font-semibold">Reject {label(plot)}</h2>
          <p className="text-sm text-muted">The reason goes in the rejection log.</p>
          <div>
            <Textarea name="reason" rows={3} placeholder="Reason" aria-invalid={!!errors.reason} />
            {errors.reason && <p role="alert" className="mt-1.5 text-xs text-red-500">{errors.reason}</p>}
          </div>
          <div className="flex gap-2"><Button>Reject plot</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
          {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}
        </form>
      )}
    </dialog>
  );
}
