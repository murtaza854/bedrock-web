import { Input } from "./input";

export type Errors = Record<string, string>;

export function Field({ error, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div>
      <Input {...p} aria-invalid={!!error} />
      {error && <p role="alert" className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// rules: field name -> message shown when that field is blank.
export function required(f: Record<string, FormDataEntryValue>, rules: Errors): Errors {
  const e: Errors = {};
  for (const k in rules) if (!String(f[k] ?? "").trim()) e[k] = rules[k];
  return e;
}
