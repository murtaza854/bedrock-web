// Types mirror the Go structs in bedrock-api/feasibility/types.go. Money is whole rupees.
export type Level = "claimed" | "ai_unverified" | "site_verified" | "document_verified" | "authority_confirmed";
export const LEVELS: Level[] = ["claimed", "ai_unverified", "site_verified", "document_verified", "authority_confirmed"];
export const FLOOR_TYPES = ["ground", "upper", "basement", "parking"];
export const USES = ["shop", "office", "apartment", "other"];
export const BASES = ["fixed", "per_built_sqft", "pct_of_land", "pct_of_construction", "pct_of_revenue"];
export const COVERS = ["unknown", "structure_only", "finished", "includes_services"];
export const LAND_BASES = ["manual", "latest", "median", "lowest", "specific"];
export const PCT_BASES = ["pct_of_land", "pct_of_construction", "pct_of_revenue"];

export type Floor = {
  label: string; floor_type: string; use: string; built_area_sqft: number; sellable_ratio: number; ratio_verification: Level;
  price_mode: "per_sqft" | "fixed_total"; price_per_sqft: number; fixed_unit_price: number; unit_count: number;
  price_basis_confirmed: boolean; price_verification: Level;
};
export type CostRow = { label: string; basis: string; amount: number; rate: number; verification: Level; note: string };
export type Model = {
  id: number; plot_id: number; name: string; scenario_label: string; is_primary: boolean;
  plot_area_sqyd: number; floors: Floor[]; land_price: number; land_price_basis: string; land_quote_id: number | null; land_source: string; land_verification: Level;
  construction_per_sqft: number; construction_covers: string; construction_note: string; construction_verification: Level;
  costs: CostRow[]; target_margin: number;
};
export type FieldError = { field: string; message: string };
export type Output = {
  plot_area_sqyd: number; plot_area_sqft: number; built_area_sqft: number; sellable_area_sqft: number;
  floors: { label: string; built_sqft: number; sellable_sqft: number; revenue: number }[];
  revenue: number; land: number; construction: number; other_costs: number; cost_lines: { label: string; amount: number }[];
  total_cost: number; profit: number; margin_on_cost: number | null; margin_on_revenue: number | null; land_share: number | null;
  break_even_land: number; residual_land: number; asking_gap: number; asking_vs_residual: number | null; land_per_sqyd: number; land_per_plot_sqft: number;
  sensitivity: { price_pct: number; construction_pct: number; land_pct: number; profit: number; margin_on_cost: number | null }[];
  warnings: { code: string; message: string }[];
  confidence: { items: { name: string; level: Level; verified: boolean }[]; verified: number; total: number; label: string };
};
export type Entry = { model: Model; output: Output | null; errors: FieldError[] | null };

export const SQFT_PER_SQYD = 9;
const LAKH = 100_000, CRORE = 10_000_000;
// 63.00 crore / 45.50 lakh / plain below a lakh. Same rules as feasibility.FormatCrore in Go.
export function crore(n: number): string {
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= CRORE) return `${s}${(a / CRORE).toFixed(2)} crore`;
  if (a >= LAKH) return `${s}${(a / LAKH).toFixed(2)} lakh`;
  return n.toLocaleString();
}
export const exact = (n: number) => "PKR " + n.toLocaleString();
export const pct = (x: number | null | undefined, d = 2) => (x == null ? "-" : `${(x * 100).toFixed(d)}%`);

export const blankFloor = (): Floor => ({
  label: "", floor_type: "upper", use: "office", built_area_sqft: 0, sellable_ratio: 1, ratio_verification: "claimed",
  price_mode: "per_sqft", price_per_sqft: 0, fixed_unit_price: 0, unit_count: 0, price_basis_confirmed: false, price_verification: "claimed",
});

// api.ts throws the response text; a 422 carries {"errors":[...]}
export function apiErrors(e: unknown): FieldError[] {
  try { return JSON.parse((e as Error).message).errors ?? []; } catch { return [{ field: "", message: (e as Error).message }]; }
}
