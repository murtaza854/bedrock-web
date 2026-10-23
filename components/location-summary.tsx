"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { mapsLink, metres } from "@/lib/geo";
import { cap, label } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";

const money = (n: number) => Math.round(n).toLocaleString();

// Where the plot is, what is near it, and what similar plots in the area are priced at.
export function LocationSummary({ plot }: { plot: any }) {
  const [near, setNear] = useState<any>(null);
  const [comp, setComp] = useState<any>(null);
  useEffect(() => { get(`/plots/${plot.id}/distances`).then(setNear); get(`/plots/${plot.id}/comparables`).then(setComp); }, [plot.id]);
  if (!near || !comp) return null;
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Location and comparables</h2>
        <Link href="/dashboard/map" className="text-sm text-muted hover:text-ink">Map →</Link>
      </div>
      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <div className="text-sm">
          {near.has_location ? (
            <>
              <p className="text-muted">{plot.gps_lat.toFixed(5)}, {plot.gps_lon.toFixed(5)} · <a href={mapsLink(plot.gps_lat, plot.gps_lon)} target="_blank" rel="noreferrer" className="underline hover:text-ink">Open in a map</a></p>
              {near.nearest.length ? (
                <ul className="mt-3">{near.nearest.map((n: any) => (
                  <li key={n.kind} className="flex items-center justify-between border-t border-line py-2 first:border-t-0 first:pt-0"><span>{cap(n.kind)}<span className="ml-2 text-muted">{n.name}</span>{n.stale && <span className="ml-2"><Badge tone="warn">Check it's still there</Badge></span>}</span><span>{metres(n.meters)}</span></li>))}</ul>
              ) : <p className="mt-3 text-muted">No anchors on the map yet, so there are no distances to show.</p>}
            </>
          ) : <p className="text-muted">No location yet. <Link href={`/dashboard/plots/${plot.id}/edit`} className="underline hover:text-ink">Add coordinates</Link> to see this plot on the map and measure distances.</p>}
        </div>
        <div className="text-sm">
          {comp.note ? <p className="text-muted">{comp.note}</p> : comp.n ? (
            <>
              <p>{comp.vs_median != null
                ? <><b className="font-medium">{Math.abs(comp.vs_median) < 0.005 ? "In line with" : `${Math.round(Math.abs(comp.vs_median) * 100)}% ${comp.vs_median > 0 ? "above" : "below"}`}</b> the median of {comp.n} similar plot{comp.n === 1 ? "" : "s"} in {comp.area} ({money(comp.median)} per sq yd).</>
                : <>{comp.n} similar plot{comp.n === 1 ? "" : "s"} in {comp.area}, median {money(comp.median)} per sq yd. This plot has no price yet to compare.</>}</p>
              <ul className="mt-3">{comp.comps.map((c: any) => (
                <li key={c.id} className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0 first:pt-0">
                  <span><Link href={`/dashboard/plots/${c.id}`} className="font-medium">{c.plot_label}</Link><span className="ml-2 text-xs text-muted">{c.size_sqyd} sq yd{c.distance_m != null && ` · ${metres(c.distance_m)} away`}</span></span>
                  <span className="text-muted">{money(c.ppsy)} <span className="text-xs">({c.basis})</span></span></li>))}</ul>
              {comp.n < 3 && <p className="mt-2 text-xs text-muted">Only {comp.n} comparable{comp.n === 1 ? "" : "s"}: treat the median as a hint, not a benchmark.</p>}
            </>
          ) : <p className="text-muted">No similar priced plots in {comp.area} yet (same area, 60% to 160% of this plot's size). Quote more plots there to build a benchmark.</p>}
        </div>
      </div>
    </section>
  );
}
