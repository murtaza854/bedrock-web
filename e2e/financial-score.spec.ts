import { API, expect, test } from "./fixtures";

// Both financial fields start at weight 0 (switched off). A test switches one on, and always puts it back.
async function field(request: any, key: string) {
  const profiles = await (await request.get(`${API}/score/profiles`)).json();
  return profiles.find((p: any) => p.name === "Residential").fields.find((f: any) => f.key === key);
}
async function setWeight(request: any, f: any, weight: number) {
  const r = await request.patch(`${API}/score/fields/${f.id}`, { data: { weight, lo_zero: f.lo_zero, lo_ideal: f.lo_ideal, hi_ideal: f.hi_ideal, hi_zero: f.hi_zero } });
  expect(r.ok(), await r.text()).toBeTruthy();
}
async function financial(request: any, plotId: number, key: string) {
  const sc = await (await request.get(`${API}/plots/${plotId}/score`)).json();
  return sc.sections.find((s: any) => s.key === "financial")?.fields.find((f: any) => f.key === key);
}
const GROUND = { label: "Ground", floor_type: "ground", use: "shop", built_area_sqft: 3000, sellable_ratio: 1, price_mode: "per_sqft", price_per_sqft: 120_000, unit_count: 0, fixed_unit_price: 0 };
const UPPER = (i: number) => ({ ...GROUND, label: `Floor ${i}`, floor_type: "upper", use: "office", price_per_sqft: 30_000 });
// the golden case: land 630m, revenue 810m, profit 72m, margin on cost 9.76%, residual land 567m
async function goldenModel(request: any, plotId: number, name: string, level: string) {
  const m = await (await request.post(`${API}/plots/${plotId}/financial-models`, { data: { name, scenario_label: "" } })).json();
  const v = { ratio_verification: level, price_verification: level };
  const r = await request.put(`${API}/financial-models/${m.id}`, { data: { ...m, floors: [GROUND, ...[1, 2, 3, 4, 5].map(UPPER)].map((f) => ({ ...f, ...v })),
    construction_per_sqft: 6000, construction_covers: "finished", construction_verification: level, land_price: 630_000_000, land_price_basis: "manual", land_verification: level, target_margin: 0.2 } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return m;
}

test.describe("The scorecard reads the primary financial model", () => {
  test("with no model it says it needs one, and earns nothing", async ({ request, plot }) => {
    const f = await field(request, "fin_margin");
    await setWeight(request, f, 5);
    try {
      const p = await plot({});
      const row = await financial(request, p.id, "fin_margin");
      expect(row.status).toBe("unknown");
      expect(row.why).toBe("Needs a primary financial model for this plot.");
      expect(row.earned).toBe(0);
    } finally { await setWeight(request, f, 0); }
  });

  test("an incomplete model (no floors yet) counts as unknown", async ({ request, plot }) => {
    const f = await field(request, "fin_margin");
    await setWeight(request, f, 5);
    try {
      const p = await plot({});
      await request.post(`${API}/plots/${p.id}/financial-models`, { data: { name: "Draft" } });
      const row = await financial(request, p.id, "fin_margin");
      expect(row.status).toBe("unknown");
      expect(row.why).toBe("The financial model is incomplete.");
    } finally { await setWeight(request, f, 0); }
  });

  test("a model built on claims shows its margin but earns nothing until its inputs are verified", async ({ request, plot, page }) => {
    const f = await field(request, "fin_margin");
    await setWeight(request, f, 5);
    try {
      const p = await plot({});
      await goldenModel(request, p.id, "Claims", "claimed");
      const row = await financial(request, p.id, "fin_margin");
      expect(row.status).toBe("unverified");
      expect(row.earned).toBe(0);
      expect(row.would_be).toBeCloseTo(0.488, 2); // a 9.76% margin: halfway up the band from 0% to 20%
      expect(row.display).toBe("10%");
      await page.goto(`/dashboard/plots/${p.id}/score`);
      const ui = page.locator("tr", { hasText: "Margin on cost (feasibility)" });
      await expect(ui).toContainText("Unverified");
      await expect(ui).toContainText("Counts as unknown until confirmed");
      await expect(ui).toContainText("0 / 5");
    } finally { await setWeight(request, f, 0); }
  });

  test("once every input is document-verified or better, the margin earns its points", async ({ request, plot, page }) => {
    const f = await field(request, "fin_margin");
    await setWeight(request, f, 5);
    try {
      const p = await plot({});
      await goldenModel(request, p.id, "Verified", "document_verified");
      const row = await financial(request, p.id, "fin_margin");
      expect(row.status).toBe("scored");
      expect(row.points).toBeCloseTo(0.488, 2);
      expect(row.earned).toBeCloseTo(5 * 0.488, 1);
      await page.goto(`/dashboard/plots/${p.id}/score`);
      const ui = page.locator("tr", { hasText: "Margin on cost (feasibility)" });
      await expect(ui).not.toContainText("Unverified");
      await expect(ui).toContainText("2.4 / 5");
    } finally { await setWeight(request, f, 0); }
  });

  test("one unverified input is enough to keep the whole model out of the score", async ({ request, plot }) => {
    const f = await field(request, "fin_margin");
    await setWeight(request, f, 5);
    try {
      const p = await plot({});
      const m = await goldenModel(request, p.id, "Almost", "document_verified");
      const saved = await (await request.get(`${API}/financial-models/${m.id}`)).json();
      const r = await request.put(`${API}/financial-models/${m.id}`, { data: { ...saved.model, land_verification: "claimed" } }); // just the land price
      expect(r.ok(), await r.text()).toBeTruthy();
      expect((await financial(request, p.id, "fin_margin")).status).toBe("unverified");
    } finally { await setWeight(request, f, 0); }
  });

  test("only the primary model counts: making an unverified one primary takes the score away", async ({ request, plot }) => {
    const f = await field(request, "fin_margin");
    await setWeight(request, f, 5);
    try {
      const p = await plot({});
      await goldenModel(request, p.id, "Good", "document_verified"); // the first model is primary
      const weak = await goldenModel(request, p.id, "Weak", "claimed");
      expect((await financial(request, p.id, "fin_margin")).status).toBe("scored");
      expect((await request.post(`${API}/financial-models/${weak.id}/primary`, { data: {} })).ok()).toBeTruthy();
      expect((await financial(request, p.id, "fin_margin")).status).toBe("unverified");
    } finally { await setWeight(request, f, 0); }
  });

  test("the asking-versus-residual gap scores too: 630m asked against a 567m residual is 11% above", async ({ request, plot }) => {
    const f = await field(request, "fin_gap");
    await setWeight(request, f, 5);
    try {
      const p = await plot({});
      await goldenModel(request, p.id, "Gap", "document_verified");
      const row = await financial(request, p.id, "fin_gap");
      expect(row.status).toBe("scored");
      expect(row.display).toBe("11%");
      expect(row.points).toBeCloseTo((0.25 - 0.1111) / 0.25, 2); // falls from full points at 0% above to zero at 25% above
    } finally { await setWeight(request, f, 0); }
  });

  test("both fields are off by default, so a score ignores the financial model until you choose otherwise", async ({ request, plot }) => {
    const p = await plot({});
    await goldenModel(request, p.id, "Ignored", "document_verified");
    expect((await field(request, "fin_margin")).weight).toBe(0);
    expect(await financial(request, p.id, "fin_margin")).toBeUndefined();
    expect(await financial(request, p.id, "fin_gap")).toBeUndefined();
  });
});
