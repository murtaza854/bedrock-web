"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { fieldBase } from "./input";

// Spelling-tolerant: "Gulshan e Iqbal", "gulshan-e-iqbal" and "gulshaneiqbal" all compare equal.
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// A text field with suggestions. Unlike Select, whatever is typed is the value, so a new name needs no extra step.
// `first` are shown before the rest (for example, areas you have already used). Pass `name` to submit with a form.
export function Combobox({ options, first = [], name, defaultValue = "", placeholder, label, error, autoFocus }: {
  options: string[]; first?: string[]; name?: string; defaultValue?: string; placeholder?: string; label: string; error?: string; autoFocus?: boolean;
}) {
  const [text, setText] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    const q = key(text);
    const seen = new Set<string>(), all: { name: string; used: boolean }[] = [];
    for (const [names, used] of [[first, true], [options, false]] as const)
      for (const n of names) if (!seen.has(key(n))) { seen.add(key(n)); all.push({ name: n, used }); }
    if (!q) return all.slice(0, 60);
    const starts = all.filter((a) => key(a.name).startsWith(q)), rest = all.filter((a) => !key(a.name).startsWith(q) && key(a.name).includes(q));
    return [...starts, ...rest].slice(0, 60);
  }, [text, options, first]);
  const exact = shown.some((a) => key(a.name) === key(text));
  const rows = shown.length + (text.trim() && !exact ? 1 : 0); // the last row, "Use X as a new area", when nothing matches exactly

  useEffect(() => { setActive(0); }, [text]);
  useEffect(() => { list.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [active]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const pick = (i: number) => { if (i < shown.length) setText(shown[i].name); setOpen(false); };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) setOpen(true); else setActive((a) => Math.min(a + 1, rows - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && text.trim()) { e.preventDefault(); pick(active); } // Enter picks the highlighted row, and never submits the form while the list is open
    else if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === "Tab") setOpen(false);
  };
  return (
    <div ref={root} className="relative">
      <input name={name} value={text} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off" aria-label={label} aria-invalid={!!error}
        role="combobox" aria-expanded={open} aria-autocomplete="list" className={fieldBase}
        onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={keys} />
      {error && <p role="alert" className="mt-1.5 text-xs text-red-500">{error}</p>}
      {open && rows > 0 && (
        <ul ref={list} role="listbox" aria-label={label} className="absolute left-0 z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg shadow-black/5">
          {shown.map((a, i) => (
            <li key={a.name} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(i); }}
              className={`flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm ${i === active ? "bg-line/70" : ""}`}>
              <span className="truncate">{a.name}</span>{a.used && <span className="shrink-0 text-xs text-muted">used</span>}
            </li>
          ))}
          {text.trim() && !exact && (
            <li role="option" aria-selected={active === shown.length} onMouseEnter={() => setActive(shown.length)} onMouseDown={(e) => { e.preventDefault(); pick(shown.length); }}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${active === shown.length ? "bg-line/70" : ""}`}>
              Use <b className="font-medium">{text.trim()}</b> as a new area
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
