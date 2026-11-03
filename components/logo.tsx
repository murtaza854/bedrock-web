// Three rock layers, widening downward: the ground a decision stands on.
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="currentColor">
      <rect x="9" y="4" width="14" height="6" rx="2" opacity=".55" />
      <rect x="5" y="13" width="22" height="6" rx="2" opacity=".78" />
      <rect x="1" y="22" width="30" height="6" rx="2" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-accent ${className}`}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight text-ink">Bedrock</span>
    </span>
  );
}
