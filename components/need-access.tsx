"use client";
import { can, useMe } from "@/lib/auth";

// A whole tab is closed to a role that cannot read it. The API refuses it too; this says so on screen instead of leaving
// a blank page, and rendering nothing until we know who is asking means the browser never requests the data.
export function NeedAccess({ area, children }: { area: string; children: React.ReactNode }) {
  const me = useMe();
  if (!me) return null;
  if (!can(me, area)) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Not available to you</h1>
        <p className="mt-2 text-sm text-muted">Your role cannot open this page. Ask an owner if you need access.</p>
      </div>
    );
  }
  return <>{children}</>;
}
