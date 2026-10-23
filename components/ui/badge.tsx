const tones: Record<string, string> = {
  neutral: "bg-line text-muted",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  good: "bg-accent text-bg",
  bad: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};
// verification level -> tone
export const levelTone: Record<string, string> = {
  claimed: "neutral", ai_unverified: "warn", site_verified: "violet", document_verified: "info", authority_confirmed: "good",
};

export function Badge({ tone = "neutral", children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
