"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { get, patch, post } from "@/lib/api";
import { SEED_AREAS } from "@/lib/areas";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Errors, Field, required } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { parseCoords } from "@/lib/geo";
import { LocationPicker } from "@/components/location-picker";
import { StepBar } from "@/components/step-bar";
import { canSeeMoney, useMe } from "@/lib/auth";

const Label = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;

// One form for adding and editing a plot. Pass `plot` to edit.
export function PlotForm({ plot }: { plot?: any }) {
  const router = useRouter();
  const me = useMe();
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState(plot?.gps_lat != null ? `${plot.gps_lat}, ${plot.gps_lon}` : "");
  const [byHand, setByHand] = useState(false);
  // areas you have already used come first in the list
  const [used, setUsed] = useState<string[]>([]);
  useEffect(() => { get("/plots").then((ps: any[]) => setUsed([...new Set<string>(ps.map((p) => p.area))].sort())).catch(() => {}); }, []);
  const back = plot ? `/dashboard/plots/${plot.id}` : "/dashboard/plots";

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const err = required(f, { area: "Enter an area", plot_no: "Enter a plot number" });
    if (f.size && !(Number(f.size) > 0)) err.size = "Size must be a positive number";
    const pos = coords.trim() ? parseCoords(coords) : null;
    if (coords.trim() && !pos) err.coords = "Paste coordinates like 24.8000, 67.0500";
    setErrors(err);
    if (Object.keys(err).length) return;
    const body: Record<string, unknown> = { area: f.area, sector: f.sector, street: f.street, plot_no: f.plot_no,
      size_sqyd: f.size ? Number(f.size) : null, corner: f.corner === "" ? null : f.corner === "yes" };
    if (pos) { body.gps_lat = pos.lat; body.gps_lon = pos.lon; }
    else if (plot?.gps_lat != null) body.clear_location = true; // the pin was removed from a plot that had one
    setBusy(true);
    try {
      const r = await (plot ? patch(`/plots/${plot.id}`, body) : post("/plots", body));
      if (!plot) return router.push(`/dashboard/plots/${r.id}/setup`); // new plot: offer quotes, facts, tasks and offers next
    } catch (x) {
      setBusy(false);
      return setErrors({ form: (x as Error).message.includes("duplicate") ? "A plot with this area, sector and number already exists" : "Could not save the plot" });
    }
    router.push("/dashboard/plots");
  };

  return (
    <div className="max-w-xl">
      <Link href={back} className="text-sm text-muted hover:text-ink">← {plot ? "Back to plot" : "Plots"}</Link>
      {!plot && me && <div className="mt-4"><StepBar step={0} total={canSeeMoney(me.role) ? 5 : 4} /></div>}
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{plot ? "Edit plot" : "Add plot"}</h1>
      <form onSubmit={save} noValidate className="mt-8 grid gap-5">
        <div><Label>Area</Label><Combobox name="area" label="Area" placeholder="DHA Phase 8, Bahadurabad, ..." defaultValue={plot?.area} options={SEED_AREAS} first={used} error={errors.area} autoFocus /></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><Label>Sector (optional)</Label><Field name="sector" defaultValue={plot?.sector} /></div>
          <div><Label>Street (optional)</Label><Field name="street" defaultValue={plot?.street} /></div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><Label>Plot number</Label><Field name="plot_no" defaultValue={plot?.plot_no} error={errors.plot_no} /></div>
          <div><Label>Size (sq yd)</Label><Field name="size" type="number" defaultValue={plot?.size_sqyd ?? ""} error={errors.size} /></div>
        </div>
        <div>
          <Label>Location (optional)</Label>
          <LocationPicker value={coords.trim() ? parseCoords(coords) : null} onChange={(p) => { setCoords(`${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`); setErrors((e) => ({ ...e, coords: "" })); }} onClear={() => { setCoords(""); setErrors((e) => ({ ...e, coords: "" })); }} />
          <button type="button" onClick={() => setByHand(!byHand)} className="mt-2 text-xs text-muted underline hover:text-ink">{byHand ? "Hide the coordinates" : "Type the coordinates instead"}</button>
          {byHand && <div className="mt-2"><Field name="coords" value={coords} onChange={(e) => setCoords(e.target.value)} placeholder="24.8000, 67.0500" /></div>}
          {errors.coords && <p role="alert" className="mt-1.5 text-xs text-red-500">{errors.coords}</p>}
        </div>
        <div>
          <Label>Corner</Label>
          <Select name="corner" label="Corner" defaultValue={plot?.corner == null ? "" : plot.corner ? "yes" : "no"}
            options={[{ value: "", label: "Unknown" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button disabled={busy}>{plot ? "Save changes" : "Add plot"}</Button>
          <Link href={back} className="rounded-lg bg-line/50 px-4 py-2.5 text-sm font-medium hover:bg-line">Cancel</Link>
        </div>
        {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}
      </form>
    </div>
  );
}
