export const STATUSES = ["new", "shortlisted", "negotiating", "rejected", "bought"] as const;
export const DOT: Record<string, string> = { new: "bg-muted/50", shortlisted: "bg-sky-400", negotiating: "bg-amber-400", rejected: "bg-red-500", bought: "bg-accent" };
export const cap = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const label = (p: any) => `${p.area} ${p.sector} #${p.plot_no}`.replace(/\s+/g, " ");
export const ppsy = (p: any) => (p.price && p.size_sqyd ? p.price / p.size_sqyd : null);
