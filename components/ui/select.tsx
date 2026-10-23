"use client";
import { useEffect, useRef, useState } from "react";
import { fieldBase } from "./input";

export type Option = { value: string; label: string; dot?: string };

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-muted"><path d="m6 9 6 6 6-6" /></svg>
);
const Check = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);

// Custom listbox. "field" matches inputs; "ghost" is a compact inline trigger. Pass `name` to submit with a form.
export function Select({ options, value, defaultValue = "", onChange, name, variant = "field", className = "", label, disabled = false }: {
  options: Option[]; value?: string; defaultValue?: string; onChange?: (v: string) => void;
  name?: string; variant?: "field" | "ghost"; className?: string; label: string; disabled?: boolean;
}) {
  const [inner, setInner] = useState(defaultValue);
  const v = value ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === v);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const pick = (o: Option) => { setInner(o.value); onChange?.(o.value); setOpen(false); };
  const openList = () => { setActive(Math.max(0, options.findIndex((o) => o.value === v))); setOpen(true); };
  const key = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(options[active]); }
    else if (e.key === "Tab") setOpen(false);
  };

  const trigger = variant === "field"
    ? `${fieldBase} flex items-center justify-between gap-3 text-left`
    : "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition hover:bg-line/60";
  return (
    <div ref={root} className={`relative ${variant === "field" ? "w-full" : "inline-block"} ${className}`}>
      {name && <input type="hidden" name={name} value={v} />}
      <button type="button" role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="listbox" disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())} onKeyDown={key} className={`${trigger} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
        <span className="flex items-center gap-2 truncate">
          {selected?.dot && <i className={`size-2 shrink-0 rounded-full ${selected.dot}`} />}
          {selected?.label ?? <span className="text-muted">Select</span>}
        </span>
        <Chevron />
      </button>
      {open && (
        <ul role="listbox" aria-label={label}
          className="absolute left-0 z-30 mt-1.5 max-h-64 min-w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg shadow-black/5">
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === v} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              className={`flex cursor-pointer items-center justify-between gap-6 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${i === active ? "bg-line/70" : ""}`}>
              <span className="flex items-center gap-2">{o.dot && <i className={`size-2 rounded-full ${o.dot}`} />}{o.label}</span>
              {o.value === v && <Check />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
