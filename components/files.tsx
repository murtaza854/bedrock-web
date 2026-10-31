"use client";
import { useRef, useState } from "react";
import { API, del, upload } from "@/lib/api";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Files attached to a plot: the lease, a report page, a photo. They are the evidence behind the facts typed in.
export type PlotFile = { id: number; plot_id: number; label: string; filename: string; mime: string; size: number; original_size: number; created_by: string; created_at: string };
export const fileUrl = (id: number) => `${API}/files/${id}`;
const size = (n: number) => (n < 1 << 20 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1 << 20)).toFixed(1)} MB`);

// what to say about a saved file in a list of what was added
export const savedNote = (f: PlotFile) => f.label + (f.original_size > 0 ? ` (shrunk from ${size(f.original_size)} to ${size(f.size)})` : "");
// Choose one or several files, upload them one after another. A label is used when a single file is chosen; otherwise each
// file is named after itself. onUploaded gets each saved file; onDone says how many failed (the rest are saved).
export function FileUpload({ plotId, onUploaded, onDone }: { plotId: string | number; onUploaded?: (f: PlotFile) => void; onDone?: (failed: number) => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState("");
  const [errs, setErrs] = useState<string[]>([]);
  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const files = (form.getAll("file") as File[]).filter((f) => f.size > 0);
    if (!files.length) return setErrs(["Choose an image or a PDF first"]);
    const label = String(form.get("label") ?? "").trim(), keep = form.get("keep_original");
    const bad: string[] = [];
    for (const [i, file] of files.entries()) {
      setBusy(files.length > 1 ? `Uploading ${i + 1} of ${files.length}...` : "Uploading...");
      const one = new FormData();
      one.append("file", file);
      if (files.length === 1 && label) one.append("label", label);
      if (keep) one.append("keep_original", "1");
      try { const saved = await upload(`/plots/${plotId}/files`, one); onUploaded?.(saved); }
      catch (x) { bad.push(`${file.name}: ${(x as Error).message || "could not upload"}`); }
    }
    setBusy(""); setErrs(bad);
    if (bad.length < files.length) ref.current?.reset();
    onDone?.(bad.length);
  };
  return (
    <form ref={ref} onSubmit={send} noValidate className="grid items-start gap-3 md:grid-cols-4">
      <div className="md:col-span-2"><p className="mb-1.5 text-xs text-muted">Images or PDFs, up to 15 MB each. Choose several at once if you like.</p>
        <input name="file" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="File"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-line/50 file:px-3.5 file:py-2.5 file:text-sm file:font-medium hover:file:bg-line" /></div>
      <div><p className="mb-1.5 text-xs text-muted">Label (for a single file)</p><Input name="label" placeholder="e.g. Lease deed" aria-label="File label" maxLength={120} /></div>
      <div className="flex items-end"><Button disabled={!!busy}>{busy || "Upload"}</Button></div>
      <label className="flex items-center gap-2 text-xs text-muted md:col-span-4"><input type="checkbox" name="keep_original" value="1" className="size-4 accent-[var(--accent)]" />Keep the original. Big JPEG and PNG scans are shrunk to save space, and a scan stays readable.</label>
      {errs.length > 0 && <ul role="alert" className="grid gap-1 text-sm text-red-500 md:col-span-4">{errs.map((m) => <li key={m}>{m}</li>)}</ul>}
    </form>
  );
}

// The Files section of the plot page.
export function FilesSection({ plotId, files, canAdd, canDelete, onChange }: { plotId: string; files: PlotFile[]; canAdd: boolean; canDelete: boolean; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [doomed, setDoomed] = useState<PlotFile | null>(null);
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Files<span className="ml-3 normal-case tracking-normal">{files.length}</span></h2>
        {canAdd && <button onClick={() => setAdding(!adding)} className="text-sm text-muted hover:text-ink">{adding ? "Cancel" : "+ Add file"}</button>}
      </div>
      {adding && <div className="mt-4"><FileUpload plotId={plotId} onDone={(failed) => { onChange(); if (!failed) setAdding(false); }} /></div>}
      {files.length ? (
        <ul className="mt-4 grid gap-3 text-sm">{files.map((f) => (
          <li key={f.id} className="flex items-center gap-4 border-t border-line pt-3 first:border-t-0 first:pt-0">
            <a href={fileUrl(f.id)} target="_blank" rel="noreferrer" className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-line/50 text-xs font-medium text-muted" aria-label={`Open ${f.label}`}>
              {f.mime.startsWith("image/") ? <img src={fileUrl(f.id)} alt="" className="size-full object-cover" /> : "PDF"}</a>
            <div className="min-w-0 flex-1"><a href={fileUrl(f.id)} target="_blank" rel="noreferrer" className="font-medium hover:underline">{f.label}</a>
              <p className="truncate text-xs text-muted">{f.filename} · {size(f.size)}{f.original_size > 0 && ` (shrunk from ${size(f.original_size)})`} · {new Date(f.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p></div>
            {canDelete && <button onClick={() => setDoomed(f)} className="rounded-lg bg-line/50 px-3 py-1.5 text-xs font-medium hover:bg-line">Delete</button>}
          </li>))}</ul>
      ) : !adding && <p className="mt-4 text-sm text-muted">No files yet. Attach the lease, a report or a photo.</p>}
      <ConfirmDialog open={!!doomed} title={`Delete ${doomed?.label}?`} text="The file is removed from this plot. Facts that pointed at it keep their text but lose the link." confirm="Delete file"
        onClose={() => setDoomed(null)} onConfirm={() => del(`/files/${doomed!.id}`).then(onChange)} />
    </section>
  );
}
