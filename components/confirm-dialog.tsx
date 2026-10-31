"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Asks before something that cannot be undone. `open` false = closed.
export function ConfirmDialog({ open, title, text, confirm, onClose, onConfirm }:
  { open: boolean; title: string; text: string; confirm: string; onClose: () => void; onConfirm: () => Promise<unknown> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setErr(""); setBusy(false); ref.current?.showModal(); } else ref.current?.close(); }, [open]);
  const go = async () => {
    setBusy(true);
    try { await onConfirm(); onClose(); } catch (x) { setErr((x as Error).message || "Could not do that, try again"); setBusy(false); }
  };
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-96 max-w-full rounded-xl border border-line bg-bg p-6 text-ink backdrop:bg-black/30">
      {open && (
        <div className="grid gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted">{text}</p>
          <div className="flex gap-2 pt-1">
            <button type="button" disabled={busy} onClick={go} className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">{confirm}</button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
          {err && <p role="alert" className="text-sm text-red-500">{err}</p>}
        </div>
      )}
    </dialog>
  );
}
