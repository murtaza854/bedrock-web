"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { API, del, get, post } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { MapOverlays } from "@/components/map-overlays";
import { ANCHOR_KINDS, ANCHOR_LETTER, GREY, KARACHI, STATUS_HEX, metres, scoreHex } from "@/lib/geo";
import { cap, label, ppsy } from "@/lib/plots";
import { useSettings } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

const LAYERS = [{ value: "status", label: "Status" }, { value: "score", label: "Score" }, { value: "price", label: "Price per sq yd" }];
const LEGEND: Record<string, [string, string][]> = {
  status: Object.entries(STATUS_HEX).map(([k, c]) => [cap(k), c]),
  score: [["60 and over", "#4ade80"], ["30 to 59", "#fbbf24"], ["Under 30", "#ef4444"], ["Not scored", GREY]],
  price: [["10%+ below the median", "#4ade80"], ["Within 10% of it", "#fbbf24"], ["10%+ above the median", "#ef4444"], ["No price", GREY]],
};
const STYLE = { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] };

export default function MapPage() {
  const { anchor_stale_days } = useSettings();
  const me = useMe();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const lib = useRef<any>(null);
  const live = useRef<any[]>([]);
  const fitted = useRef(false);
  const mode = useRef(false);
  const [ready, setReady] = useState(false);
  const [plots, setPlots] = useState<any[] | null>(null);
  const [rank, setRank] = useState<Record<number, any>>({});
  const [anchors, setAnchors] = useState<any[]>([]);
  const [layer, setLayer] = useState("status");
  const [sel, setSel] = useState<any>(null);
  const [near, setNear] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ lat: number; lon: number } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [kind, setKind] = useState("market");
  const [removing, setRemoving] = useState<number | null>(null);
  const loadAnchors = () => get("/anchors").then(setAnchors);

  useEffect(() => {
    get("/plots").then(setPlots); loadAnchors();
    get("/score/ranking").then((r: any[]) => setRank(Object.fromEntries(r.map((x) => [x.plot_id, x]))));
  }, []);

  // create the map once, in the browser only
  useEffect(() => {
    let dead = false;
    import("maplibre-gl").then((m) => {
      if (dead || !box.current) return;
      lib.current = m.default;
      const mp = new m.default.Map({ container: box.current, style: STYLE as any, center: KARACHI, zoom: 11, attributionControl: { compact: true },
        // society map images come from the API and need the session cookie
        transformRequest: (url: string) => (url.startsWith(API) ? { url, credentials: "include" as const } : { url }) });
      mp.addControl(new m.default.NavigationControl({ showCompass: false }), "top-right");
      mp.addControl(new m.default.ScaleControl({ unit: "metric" }), "bottom-left");
      mp.on("click", (e: any) => { if (mode.current) setPending({ lat: e.lngLat.lat, lon: e.lngLat.lng }); });
      map.current = mp; setReady(true);
    });
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, []);

  const median = useMemo(() => {
    const v = (plots ?? []).map((p) => ppsy(p)).filter((x): x is number => x != null).sort((a, b) => a - b);
    return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
  }, [plots]);
  const colour = (p: any) => {
    if (layer === "status") return STATUS_HEX[p.status] ?? GREY;
    if (layer === "score") return scoreHex(rank[p.id]?.score);
    const v = ppsy(p);
    return v == null || median == null ? GREY : v <= median * 0.9 ? "#4ade80" : v >= median * 1.1 ? "#ef4444" : "#fbbf24";
  };

  // draw markers whenever the data or the layer changes
  useEffect(() => {
    if (!ready || !plots) return;
    live.current.forEach((m) => m.remove()); live.current = [];
    const bounds = new lib.current.LngLatBounds();
    plots.filter((p) => p.gps_lat != null).forEach((p) => {
      const d = document.createElement("button");
      d.type = "button"; d.title = label(p); d.setAttribute("aria-label", label(p));
      d.style.cssText = `width:16px;height:16px;border-radius:9999px;background:${colour(p)};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);cursor:pointer`;
      d.onclick = (e) => { e.stopPropagation(); setSel(p); };
      live.current.push(new lib.current.Marker({ element: d }).setLngLat([p.gps_lon, p.gps_lat]).addTo(map.current));
      bounds.extend([p.gps_lon, p.gps_lat]);
    });
    anchors.forEach((a) => {
      const d = document.createElement("div");
      d.title = `${a.name} (${cap(a.kind)})`;
      d.style.cssText = `width:18px;height:18px;border-radius:5px;background:${a.kind === "nuisance" ? "#ef4444" : "#1c1a17"};color:#fff;font:600 10px system-ui;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
      d.textContent = ANCHOR_LETTER[a.kind] ?? "?";
      live.current.push(new lib.current.Marker({ element: d }).setLngLat([a.lon, a.lat]).addTo(map.current));
      bounds.extend([a.lon, a.lat]);
    });
    if (pending) {
      const d = document.createElement("div");
      d.style.cssText = "width:18px;height:18px;border-radius:5px;border:2px dashed #3f5b4a;background:rgba(63,91,74,.25)";
      live.current.push(new lib.current.Marker({ element: d }).setLngLat([pending.lon, pending.lat]).addTo(map.current));
    }
    if (!fitted.current && !bounds.isEmpty()) { map.current.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 0 }); fitted.current = true; }
  }, [ready, plots, anchors, layer, rank, pending]);

  useEffect(() => { mode.current = adding; if (map.current) map.current.getCanvas().style.cursor = adding ? "crosshair" : ""; if (!adding) setPending(null); }, [adding]);
  useEffect(() => { setNear([]); if (sel) get(`/plots/${sel.id}/distances`).then((d) => setNear(d.nearest ?? [])); }, [sel]);

  const saveAnchor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!f.name.trim()) return setErrors({ name: "Name the place" });
    try { await post("/anchors", { name: f.name, kind, notes: f.notes, lat: pending!.lat, lon: pending!.lon }); }
    catch { return setErrors({ form: "Could not save, try again" }); }
    setAdding(false); setErrors({}); loadAnchors();
  };

  const placed = (plots ?? []).filter((p) => p.gps_lat != null), unplaced = (plots ?? []).filter((p) => p.gps_lat == null);
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Map</h1>
          <p className="mt-1 text-sm text-muted">{placed.length} of {plots?.length ?? 0} plots are placed on the map. Add a plot's location on its edit page.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select label="Colour by" variant="ghost" value={layer} onChange={setLayer} options={LAYERS.map((l) => ({ value: l.value, label: `Colour by ${l.label.toLowerCase()}` }))} />
          <Button variant={adding ? "primary" : "ghost"} onClick={() => setAdding(!adding)}>{adding ? "Cancel" : "Add an anchor"}</Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-line">
        <div ref={box} className="map-dark h-[560px] w-full" />
        {adding && !pending && <p className="absolute left-3 top-3 rounded-lg bg-surface/95 px-3 py-2 text-sm shadow">Click the map where the place is.</p>}
        {adding && pending && (
          <form onSubmit={saveAnchor} noValidate className="absolute left-3 top-3 grid w-72 gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg">
            <p className="text-xs text-muted">{pending.lat.toFixed(5)}, {pending.lon.toFixed(5)}</p>
            <Field name="name" placeholder="Name of the place" error={errors.name} autoFocus />
            <Select label="Type" value={kind} onChange={setKind} options={ANCHOR_KINDS.map((k) => ({ value: k, label: cap(k) }))} />
            <Field name="notes" placeholder="Notes (optional)" />
            <div className="flex items-center gap-2"><Button>Save anchor</Button><button type="button" onClick={() => setAdding(false)} className="text-sm text-muted hover:text-ink">Cancel</button></div>
            {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}
          </form>
        )}
        <ul className="absolute bottom-8 left-3 grid gap-1 rounded-lg bg-surface/95 px-3 py-2 text-xs shadow">
          {LEGEND[layer].map(([t, c]) => <li key={t} className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: c }} />{t}</li>)}
        </ul>
        {sel && (
          <div className="absolute bottom-8 right-3 w-72 rounded-xl border border-line bg-surface p-4 text-sm shadow-lg">
            <div className="flex items-start justify-between gap-3"><b className="font-medium">{label(sel)}</b><button onClick={() => setSel(null)} aria-label="Close" className="text-muted hover:text-ink">✕</button></div>
            <p className="mt-1 text-xs text-muted">{[sel.size_sqyd && `${sel.size_sqyd} sq yd`, cap(sel.status), sel.price && `PKR ${Math.round(sel.price).toLocaleString()}`].filter(Boolean).join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rank[sel.id] && <Badge>Score {Math.round(rank[sel.id].score)}</Badge>}
            </div>
            {near.length > 0 && <ul className="mt-3 grid gap-1 text-xs text-muted">{near.slice(0, 4).map((n) => <li key={n.kind} className="flex justify-between"><span>{cap(n.kind)}: {n.name}{n.stale && " (old)"}</span><span>{metres(n.meters)}</span></li>)}</ul>}
            <div className="mt-3 flex gap-4 text-xs"><Link href={`/dashboard/plots/${sel.id}`} className="text-muted hover:text-ink">Open plot →</Link><Link href={`/dashboard/plots/${sel.id}/report`} className="text-muted hover:text-ink">Report →</Link></div>
          </div>
        )}
      </div>

      <MapOverlays map={ready ? map.current : null} lib={lib.current} canEdit={can(me, "map", "c")} />

      {unplaced.length > 0 && (
        <section className="border-t border-line pt-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Not on the map yet<span className="ml-3 normal-case tracking-normal">{unplaced.length}</span></h2>
          <ul className="mt-4 text-sm">{unplaced.map((p) => (
            <li key={p.id} className="flex items-center justify-between border-t border-line py-2.5 first:border-t-0 first:pt-0"><Link href={`/dashboard/plots/${p.id}`} className="font-medium">{label(p)}</Link>
              <Link href={`/dashboard/plots/${p.id}/edit`} className="text-xs text-muted hover:text-ink">Add coordinates →</Link></li>))}</ul>
        </section>
      )}

      <section className="border-t border-line pt-5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Anchors<span className="ml-3 normal-case tracking-normal">{anchors.length}</span></h2>
        {anchors.length ? (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Place</th><th className="pb-2 text-left font-normal">Type</th><th className="pb-2 text-right font-normal">Last confirmed</th><th /></tr></thead>
            <tbody>{anchors.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="py-2.5 font-medium">{a.name}{a.notes && <span className="ml-2 text-xs font-normal text-muted">{a.notes}</span>}</td>
                <td className="text-muted">{cap(a.kind)}</td>
                <td className="text-right">{a.age_days > anchor_stale_days ? <Badge tone="warn">{Math.round(a.age_days / 30)} months ago</Badge> : <span className="text-muted">{a.age_days < 1 ? "today" : `${a.age_days} days ago`}</span>}</td>
                <td className="pl-4 text-right text-xs">
                  {removing === a.id ? <span><button onClick={async () => { await del(`/anchors/${a.id}`); setRemoving(null); loadAnchors(); }} className="text-red-500">Delete</button><button onClick={() => setRemoving(null)} className="ml-3 text-muted">Keep</button></span>
                    : <span className="flex justify-end gap-3 text-muted"><button onClick={async () => { await post(`/anchors/${a.id}/confirm`, {}); loadAnchors(); }} className="hover:text-ink">Still there</button><button onClick={() => setRemoving(a.id)} className="hover:text-ink">Delete</button></span>}
                </td>
              </tr>))}</tbody>
          </table>
        ) : <p className="mt-4 text-sm text-muted">No anchors yet. Use "Add an anchor" to mark main roads, markets, schools and other places that shape a location.</p>}
        <p className="mt-5 max-w-2xl text-xs text-muted">Distances are straight-line, not driving distance. Anchors go stale (a shop closes, a school moves), so confirm them now and then with "Still there".</p>
      </section>
    </div>
  );
}
