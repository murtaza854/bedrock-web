// Filled, borderless-until-focus fields. Error styling hangs off aria-invalid (set by Field).
export const fieldBase =
  "w-full rounded-lg border border-transparent bg-line/40 px-3.5 py-2.5 text-sm outline-none transition " +
  "placeholder:text-muted hover:bg-line/60 focus:border-ink/30 focus:bg-surface focus:ring-4 focus:ring-ink/5 " +
  "aria-invalid:border-red-500 aria-invalid:bg-red-500/5";

export function Input({ className = "", ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} {...p} />;
}

export function Textarea({ className = "", ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} ${className}`} {...p} />;
}
