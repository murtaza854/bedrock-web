// "Step 2 of 5" and a segmented bar, shared by the add-plot form (step 1) and the setup steps after it.
export function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${total}`}>
      <p className="text-xs uppercase tracking-wider text-muted">Step {step + 1} of {total}</p>
      <div className="mt-2 flex gap-1.5">{Array.from({ length: total }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-line"}`} />)}</div>
    </div>
  );
}
