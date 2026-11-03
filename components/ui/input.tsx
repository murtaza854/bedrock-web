"use client";
import { useEffect, useRef, useState } from "react";

// Filled, borderless-until-focus fields. Error styling hangs off aria-invalid (set by Field).
export const fieldBase =
  "w-full rounded-lg border border-transparent bg-line/40 px-3.5 py-2.5 text-sm outline-none transition " +
  "placeholder:text-muted hover:bg-line/60 focus:border-ink/30 focus:bg-surface focus:ring-4 focus:ring-ink/5 " +
  "aria-invalid:border-red-500 aria-invalid:bg-red-500/5";

// Number fields show western thousands commas (1,200,000) while typing. The browser's own type=number cannot do that,
// so it is a text field that keeps digits and one dot. Callers still see the plain number: onChange gets it in
// e.target.value, and the value that goes into a form is set to it when the form is read (the formdata event).
const clean = (s: string, signed: boolean) => {
  const t = s.replace(signed ? /[^0-9.-]/g : /[^0-9.]/g, "");
  const i = t.indexOf(".");
  const num = i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, "");
  return signed ? (num.startsWith("-") ? "-" : "") + num.replace(/-/g, "") : num;
};
const commas = (raw: string) => { const [a, ...b] = raw.split("."); return a.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (b.length ? "." + b[0] : ""); };

function NumberInput({ className = "", value, defaultValue, onChange, min, max, step, type, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  const signed = min === undefined || Number(min) < 0;
  const start = String(defaultValue ?? "");
  const [text, setText] = useState(commas(clean(start, signed)));
  const ref = useRef<HTMLInputElement>(null);
  const shown = value !== undefined ? commas(clean(String(value), signed)) : text;
  useEffect(() => {
    const f = ref.current?.form;
    if (!f) return;
    const read = (e: FormDataEvent) => { if (p.name && ref.current) e.formData.set(p.name, clean(ref.current.value, signed)); };
    const reset = () => setText(commas(clean(start, signed)));
    f.addEventListener("formdata", read);
    f.addEventListener("reset", reset);
    return () => { f.removeEventListener("formdata", read); f.removeEventListener("reset", reset); };
  });
  return (
    <input ref={ref} className={`${fieldBase} ${className}`} inputMode="decimal" autoComplete="off" {...p} placeholder={p.placeholder?.replace(/\d{4,}/g, commas)} value={shown}
      onChange={(e) => { const raw = clean(e.target.value, signed); setText(commas(raw)); e.target.value = raw; onChange?.(e); }} />
  );
}

// A password field with an eye button that shows what was typed.
function PasswordInput({ className = "", type, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input className={`${fieldBase} pr-10 ${className}`} type={shown ? "text" : "password"} {...p} />
      <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

export function Input({ className = "", ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  if (p.type === "number") return <NumberInput className={className} {...p} />;
  if (p.type === "password") return <PasswordInput className={className} {...p} />;
  return <input className={`${fieldBase} ${className}`} {...p} />;
}

export function Textarea({ className = "", ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} ${className}`} {...p} />;
}
