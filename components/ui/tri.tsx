// Yes / No / not answered. "Not answered" records nothing, so nothing is claimed that you didn't see.
export function Tri({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      <div role="group" aria-label={label} className="flex rounded-lg bg-line/40 p-0.5 text-xs">
        {[["", "Skip"], ["yes", "Yes"], ["no", "No"]].map(([v, t]) => (
          <button type="button" key={v} aria-pressed={value === v} onClick={() => onChange(v)}
            className={`rounded-md px-3 py-1.5 transition ${value === v ? (v === "yes" ? "bg-accent text-bg" : v === "no" ? "bg-ink text-bg" : "bg-line text-ink") : "text-muted hover:text-ink"}`}>{t}</button>
        ))}
      </div>
    </div>
  );
}
