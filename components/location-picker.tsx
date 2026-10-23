"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { KARACHI, parseMapInput } from "@/lib/geo";
import { Input } from "@/components/ui/input";

type Pos = { lat: number; lon: number };
const STYLE = { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] };

// Pick a plot's location without typing coordinates: search a place, click the map, drag the pin, or paste a map link.
export function LocationPicker({ value, onChange, onClear }: { value: Pos | null; onChange: (p: Pos) => void; onClear: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const lib = useRef<any>(null);
  const pin = useRef<any>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const latest = useRef(value); // the map finishes loading after the page; by then the pin may have been removed
  latest.current = value;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const place = (p: Pos, fly = false) => {
    if (!map.current) return;
    if (!pin.current) {
      pin.current = new lib.current.Marker({ draggable: true, color: "#3f5b4a" }).setLngLat([p.lon, p.lat]).addTo(map.current);
      pin.current.on("dragend", () => { const l = pin.current.getLngLat(); cb.current({ lat: l.lat, lon: l.lng }); });
    } else pin.current.setLngLat([p.lon, p.lat]);
    if (fly) map.current.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.current.getZoom(), 17), duration: 600 });
  };

  useEffect(() => {
    let dead = false;
    import("maplibre-gl").then((m) => {
      if (dead || !box.current) return;
      lib.current = m.default;
      const mp = new m.default.Map({ container: box.current, style: STYLE as any, center: value ? [value.lon, value.lat] : KARACHI, zoom: value ? 17 : 11, attributionControl: { compact: true } });
      mp.addControl(new m.default.NavigationControl({ showCompass: false }), "top-right");
      mp.on("click", (e: any) => { const p = { lat: e.lngLat.lat, lon: e.lngLat.lng }; place(p); cb.current(p); });
      map.current = mp;
      mp.on("load", () => { if (latest.current) place(latest.current); });
    });
    return () => { dead = true; map.current?.remove(); map.current = null; pin.current = null; };
  }, []);
  // typing coordinates elsewhere in the form moves the pin
  useEffect(() => {
    if (!value && pin.current) { pin.current.remove(); pin.current = null; } // cleared here or by emptying the typed coordinates
    if (!value || !map.current) return;
    const l = pin.current?.getLngLat();
    if (!l || Math.abs(l.lat - value.lat) > 1e-7 || Math.abs(l.lng - value.lon) > 1e-7) place(value, true);
  }, [value?.lat, value?.lon]);

  const search = async () => {
    const text = q.trim();
    if (!text) return;
    setMsg(""); setResults(null);
    const direct = parseMapInput(text);
    if (direct) { place(direct, true); onChange(direct); setQ(""); return; }
    if (/^https?:\/\//.test(text)) return setMsg("That link can't be read. Open it in the browser and paste the long address, or search for the place by name.");
    setBusy(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(text)}`, { headers: { "Accept-Language": "en" } });
      const j = await r.json();
      setResults(j); if (!j.length) setMsg("Nothing found. Try the area and city, like \"Bahadurabad Karachi\", then click the map to place the pin.");
    } catch { setMsg("Search isn't available right now. Click the map to place the pin instead."); }
    setBusy(false);
  };
  const here = () => {
    if (!navigator.geolocation) return setMsg("This browser can't share its location.");
    setMsg("Finding you...");
    navigator.geolocation.getCurrentPosition((g) => { const p = { lat: g.coords.latitude, lon: g.coords.longitude }; place(p, true); onChange(p); setMsg(""); },
      () => setMsg("Couldn't get your location. Allow it in the browser, or search instead."), { enableHighAccuracy: true, timeout: 15000 });
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place, or paste a map link" aria-label="Search for a place"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
        <button type="button" onClick={search} disabled={busy} className="shrink-0 rounded-lg bg-line/50 px-4 text-sm font-medium hover:bg-line disabled:opacity-50">{busy ? "..." : "Search"}</button>
      </div>
      {results && results.length > 0 && (
        <ul className="mt-2 max-h-52 overflow-auto rounded-xl border border-line bg-surface p-1 text-sm">
          {results.map((r) => (
            <li key={r.place_id}><button type="button" onClick={() => { const p = { lat: Number(r.lat), lon: Number(r.lon) }; place(p, true); onChange(p); setResults(null); }}
              className="block w-full rounded-lg px-3 py-2 text-left hover:bg-line/60">{r.display_name}</button></li>))}
        </ul>
      )}
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
      <div ref={box} className="map-dark mt-3 h-72 w-full overflow-hidden rounded-xl border border-line" />
      <p className="mt-2 text-xs text-muted">
        {value ? <>Pin at {value.lat.toFixed(5)}, {value.lon.toFixed(5)}. Drag it, or click elsewhere to move it. </> : "Search, then click the map exactly where the plot is, or leave it blank if you don't know. "}
        <button type="button" onClick={here} className="underline hover:text-ink">Use where I am now</button>
        {value && <> · <button type="button" onClick={onClear} className="underline hover:text-ink">Remove pin</button></>}
      </p>
    </div>
  );
}
