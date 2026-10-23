"use client";
import { useEffect, useRef, useState } from "react";
import { API, del, get, patch, upload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Pt = [number, number]; // lng, lat
export type Overlay = { id: number; name: string; area: string; width: number; height: number; corners: Pt[] | null; opacity: number; visible: boolean };

const MAX_MB = 40, MAX_SIDE = 8192;
const lid = (o: Overlay) => `overlay-${o.id}`;
const handleCss = "width:16px;height:16px;border-radius:4px;background:#fff;border:2px solid #3f5b4a;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:grab";

// Scanned society maps laid over the map. Aligning = dragging the image's four corners (or the middle, to move it)
// until its roads sit on the map's roads. ponytail: one image stretched over four corners; fine for a phase,
// switch to georeferenced tiles (QGIS + gdal2tiles) if a whole city or very large scans are needed.
export function MapOverlays({ map, lib, canEdit }: { map: any; lib: any; canEdit: boolean }) {
  const [list, setList] = useState<Overlay[]>([]);
  const [aligning, setAligning] = useState<number | null>(null);
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = useRef<Set<string>>(new Set());
  const handles = useRef<any[]>([]);
  const draftRef = useRef<Pt[] | null>(null);
  const pendingSave = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // dark mode inverts the whole map canvas (globals.css); flip the scans back so they keep their real colours
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement, read = () => setDark(el.dataset.theme === "dark");
    read();
    const ob = new MutationObserver(read);
    ob.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => ob.disconnect();
  }, []);
  const load = () => get("/overlays").then(setList).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  // keep the map's image layers in step with the list (and the corners being dragged)
  useEffect(() => {
    if (!map) return;
    const sync = () => {
      const want = new Set<string>();
      for (const o of list) {
        const coords = o.id === aligning ? draft : o.corners;
        if (!coords || (!o.visible && o.id !== aligning)) continue;
        const id = lid(o);
        want.add(id);
        const src = map.getSource(id);
        if (src) src.setCoordinates(coords);
        else {
          map.addSource(id, { type: "image", url: `${API}/overlays/${o.id}/image`, coordinates: coords });
          map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": o.opacity, "raster-fade-duration": 0 } });
        }
        map.setPaintProperty(id, "raster-opacity", o.opacity);
        map.setPaintProperty(id, "raster-brightness-min", dark ? 1 : 0);
        map.setPaintProperty(id, "raster-brightness-max", dark ? 0 : 1);
        map.setPaintProperty(id, "raster-hue-rotate", dark ? 180 : 0);
      }
      for (const id of shown.current) if (!want.has(id)) { if (map.getLayer(id)) map.removeLayer(id); if (map.getSource(id)) map.removeSource(id); }
      shown.current = want;
    };
    // isStyleLoaded() is false while any data is still loading, and "load" has long fired by then; "idle" always comes
    if (map.isStyleLoaded()) sync(); else map.once("idle", sync);
  }, [map, list, aligning, draft, dark]);

  // the drag handles: four corners and a middle one that moves the whole image
  useEffect(() => {
    handles.current.forEach((h) => h.remove()); handles.current = [];
    if (!map || aligning == null || !draftRef.current) return;
    const mid = (c: Pt[]): Pt => [c.reduce((s, p) => s + p[0], 0) / 4, c.reduce((s, p) => s + p[1], 0) / 4];
    const set = (c: Pt[]) => { draftRef.current = c; setDraft(c); };
    draftRef.current.forEach((p, i) => {
      const el = document.createElement("div"); el.style.cssText = handleCss; el.title = ["Top left", "Top right", "Bottom right", "Bottom left"][i];
      const m = new lib.Marker({ element: el, draggable: true }).setLngLat(p).addTo(map);
      m.on("drag", () => { const c = [...draftRef.current!] as Pt[]; const l = m.getLngLat(); c[i] = [l.lng, l.lat]; set(c); centre.setLngLat(mid(c)); });
      handles.current.push(m);
    });
    const el = document.createElement("div"); el.style.cssText = handleCss + ";border-radius:9999px;width:22px;height:22px;background:#3f5b4a"; el.title = "Drag to move the whole map";
    const centre = new lib.Marker({ element: el, draggable: true }).setLngLat(mid(draftRef.current)).addTo(map);
    // measure from where the press began: MapLibre only reports "dragstart" after the dot has already moved a little
    let from = centre.getLngLat(), start = draftRef.current;
    el.addEventListener("pointerdown", () => { from = centre.getLngLat(); start = draftRef.current!; });
    centre.on("drag", () => {
      const now = centre.getLngLat(), dx = now.lng - from.lng, dy = now.lat - from.lat;
      const c = start.map(([x, y]) => [x + dx, y + dy] as Pt);
      c.forEach((p, i) => handles.current[i].setLngLat(p)); set(c);
    });
    handles.current.push(centre);
    return () => { handles.current.forEach((h) => h.remove()); handles.current = []; };
    // handles are rebuilt only when alignment starts or stops; dragging updates them in place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, aligning]);

  const startAlign = (o: Overlay) => {
    let c = o.corners;
    if (!c) { // first time: drop it in the middle of the current view, keeping the scan's proportions
      const cv = map.getCanvas(), w = cv.clientWidth, h = cv.clientHeight;
      let bw = w * 0.6, bh = (bw * o.height) / o.width;
      if (bh > h * 0.8) { bh = h * 0.8; bw = (bh * o.width) / o.height; }
      const x0 = (w - bw) / 2, y0 = (h - bh) / 2;
      c = [[x0, y0], [x0 + bw, y0], [x0 + bw, y0 + bh], [x0, y0 + bh]].map(([x, y]) => { const l = map.unproject([x, y]); return [l.lng, l.lat] as Pt; });
    } else zoomTo(c);
    draftRef.current = c; setDraft(c); setAligning(o.id); setMsg("Drag the white corners until the scanned roads sit on the map's roads. Drag the green dot to move it.");
  };
  const stopAlign = () => { draftRef.current = null; setDraft(null); setAligning(null); setMsg(""); };
  const saveAlign = async () => {
    try { await patch(`/overlays/${aligning}`, { corners: draftRef.current }); stopAlign(); load(); setMsg("Placement saved."); }
    catch (e) { setMsg((e as Error).message); }
  };
  const zoomTo = (c: Pt[]) => { const b = new lib.LngLatBounds(); c.forEach((p) => b.extend(p)); map.fitBounds(b, { padding: 40, duration: 0 }); };
  const change = (o: Overlay, p: Partial<Overlay>, wait = 0) => {
    setList((l) => l.map((x) => (x.id === o.id ? { ...x, ...p } : x)));
    // send both settings each time, so a quick toggle can't cancel a slider change that is still waiting to save
    const next = { opacity: p.opacity ?? o.opacity, visible: p.visible ?? o.visible };
    clearTimeout(pendingSave.current[o.id]);
    pendingSave.current[o.id] = setTimeout(() => patch(`/overlays/${o.id}`, next).catch((e) => setMsg(e.message)), wait);
  };

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, fd = new FormData(form), f = fd.get("file") as File;
    if (!f?.size) return setMsg("Choose the scanned map (PNG or JPEG).");
    if (f.size > MAX_MB << 20) return setMsg(`That file is over ${MAX_MB} MB. Save it smaller or as JPEG.`);
    if (!String(fd.get("name")).trim()) return setMsg("Name the map, for example DHA Phase 6.");
    setBusy(true); setMsg("");
    try { const o = await upload("/overlays", fd); form.reset(); await load(); startAlign(o); }
    catch (x) { setMsg((x as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <section className="border-t border-line pt-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Society maps<span className="ml-3 normal-case tracking-normal">{list.length}</span></h2>
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
      {aligning != null && (
        <div className="mt-3 flex gap-2"><Button onClick={saveAlign}>Save placement</Button><Button variant="ghost" onClick={stopAlign}>Cancel</Button></div>
      )}
      {list.length > 0 && (
        <ul className="mt-4 text-sm">{list.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
            <span><span className="font-medium">{o.name}</span>{o.area && <span className="ml-2 text-xs text-muted">{o.area}</span>}
              <span className="block text-xs text-muted">{o.width} x {o.height} px{o.corners ? "" : " · not placed yet"}</span></span>
            <span className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <label className="flex items-center gap-2">Opacity
                <input type="range" min={0} max={1} step={0.05} value={o.opacity} disabled={!canEdit} aria-label={`Opacity of ${o.name}`}
                  onChange={(e) => change(o, { opacity: Number(e.target.value) }, 400)} /></label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={o.visible} disabled={!canEdit} onChange={(e) => change(o, { visible: e.target.checked })} />Show</label>
              {o.corners && <button className="hover:text-ink" onClick={() => zoomTo(o.corners!)}>Zoom to</button>}
              {canEdit && aligning == null && <button className="hover:text-ink" onClick={() => startAlign(o)}>{o.corners ? "Adjust" : "Place"}</button>}
              {canEdit && aligning == null && <button className="hover:text-red-500" onClick={async () => { if (confirm(`Delete the ${o.name} map?`)) { await del(`/overlays/${o.id}`); load(); } }}>Delete</button>}
            </span>
          </li>))}</ul>
      )}
      {canEdit && aligning == null && (
        <form onSubmit={add} noValidate className="mt-4 flex flex-wrap items-center gap-2">
          <Input name="name" placeholder="Name, e.g. DHA Phase 6" className="max-w-56" />
          <Input name="area" placeholder="Area (optional)" className="max-w-40" />
          <input name="file" type="file" accept="image/png,image/jpeg" className="text-sm" />
          <Button disabled={busy}>{busy ? "Uploading…" : "Upload map"}</Button>
        </form>
      )}
      <p className="mt-4 max-w-2xl text-xs text-muted">Upload a scan or photo of a society map you're allowed to use, as PNG or JPEG, up to {MAX_MB} MB and {MAX_SIDE.toLocaleString()} pixels a side. Line it up on main roads and roundabouts far apart from each other. A hand-placed scan is usually a few metres out, so treat plot positions on it as approximate.</p>
    </section>
  );
}
