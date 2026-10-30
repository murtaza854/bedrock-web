"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";

// The detailed model is for a plot you have actually bought. Before that, the quick feasibility is enough.
export function BoughtOnly({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { get(`/plots/${id}`).then((d) => setStatus(d.plot.status)).catch(() => setStatus("")); }, [id]);
  if (status === null) return null;
  if (status !== "bought") {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Available once the plot is bought</h1>
        <p className="mt-2 text-sm text-muted">The detailed model is for plots you own. Until then, use the quick feasibility.</p>
        <Link href={`/dashboard/plots/${id}/feasibility`} className="mt-4 inline-block rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90">Quick feasibility</Link>
      </div>
    );
  }
  return <>{children}</>;
}
