export const USES = [{ value: "residential", label: "Residential" }, { value: "commercial", label: "Commercial" }];
export const dayOf = (d?: string | null) => (d ? new Date(d.slice(0, 10) + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-");
export const today = () => new Date().toLocaleDateString("en-CA");
export const n = (v: number | null | undefined, unit = "") => (v == null ? "-" : `${v}${unit}`);
export const band = (r: any) => (r.min_sqyd == null && r.max_sqyd == null ? "Any size" : r.min_sqyd == null ? `Under ${r.max_sqyd} sq yd` : r.max_sqyd == null ? `${r.min_sqyd} sq yd and over` : `${r.min_sqyd} to ${r.max_sqyd} sq yd`);
export const setbacks = (r: any) => (r.setback_front_ft == null && r.setback_rear_ft == null && r.setback_side_ft == null ? "-" : `${n(r.setback_front_ft)} / ${n(r.setback_rear_ft)} / ${n(r.setback_side_ft)} ft`);
// a rule is "current" when it has taken effect and nothing newer covers the same area, use and size band
export function status(r: any, all: any[]): "void" | "future" | "current" | "superseded" {
  if (r.voided_at) return "void";
  if (r.effective_from.slice(0, 10) > today()) return "future";
  const newer = all.some((x) => x.id !== r.id && !x.voided_at && x.area.toLowerCase() === r.area.toLowerCase() && x.use_type === r.use_type && x.min_sqyd === r.min_sqyd && x.max_sqyd === r.max_sqyd
    && x.effective_from.slice(0, 10) <= today() && (x.effective_from > r.effective_from || (x.effective_from === r.effective_from && x.id > r.id)));
  return newer ? "superseded" : "current";
}
