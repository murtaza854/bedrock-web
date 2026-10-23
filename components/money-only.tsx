"use client";
import { canSeeMoney, useMe } from "@/lib/auth";

// Pages about money are for owners and editors. The API refuses them to everyone else; this says so on screen,
// instead of leaving a viewer who opens one by its address with a blank page. Rendering nothing until we know who
// is asking also means a viewer's browser never requests the data.
export function MoneyOnly({ children }: { children: React.ReactNode }) {
  const me = useMe();
  if (!me) return null;
  if (!canSeeMoney(me.role)) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Not available to you</h1>
        <p className="mt-2 text-sm text-muted">Prices, offers and financial models are for owners and editors. Ask an owner if you need access.</p>
      </div>
    );
  }
  return <>{children}</>;
}
