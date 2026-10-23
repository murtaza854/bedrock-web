import { API, expect, test } from "./fixtures";

// The Residential profile: plot size earns full weight (8) between 240 and 500 sq yd, but only when the size is
// confirmed by a document or the authority. Weights of the other fields do not matter here.
async function residential(request: any) {
  const profiles = await (await request.get(`${API}/score/profiles`)).json();
  const p = profiles.find((x: any) => x.name === "Residential");
  const size = p.fields.find((f: any) => f.key === "size_sqyd");
  const total = p.fields.reduce((s: number, f: any) => s + f.weight, 0);
  return { size, total, weight: size.weight as number };
}
const claim = (request: any, plotId: number, verification: string) =>
  request.post(`${API}/plots/${plotId}/claims`, { data: { field: "size", value: "300", source: "title deed", method: "", verification } });
const headline = (page: any) => page.locator("p.text-7xl");

test.describe("A plot's score", () => {
  test("a claimed value earns nothing; a document-verified one earns its full weight", async ({ page, plot, request }) => {
    const { weight, total } = await residential(request);
    const p = await plot({ plot_no: "SC-1", size_sqyd: 300 });
    await claim(request, p.id, "claimed");
    await page.goto(`/dashboard/plots/${p.id}/score`);
    const row = page.locator("tr", { hasText: "Plot size (sq yd)" });
    await expect(row).toContainText("Unverified");
    await expect(row).toContainText(`0 / ${weight}`);
    await expect(headline(page)).toContainText("0");

    await claim(request, p.id, "document_verified"); // a stronger claim for the same fact outranks the first
    await page.reload();
    await expect(row).not.toContainText("Unverified"); // a scored field shows its points and no warning badge
    await expect(row).toContainText(`${weight} / ${weight}`);
    await expect(headline(page)).toContainText(String(Math.round((weight / total) * 100)));
    await expect(page.getByText("What would raise it most")).toBeVisible();
    await expect(page.getByText(/% of the score is backed by verified information/)).toBeVisible();
  });

  test("a size far above the ideal range earns no points", async ({ page, plot, request }) => {
    const { weight } = await residential(request);
    const p = await plot({ plot_no: "SC-FAR", size_sqyd: 100 });
    await request.post(`${API}/plots/${p.id}/claims`, { data: { field: "size", value: "5000", source: "deed", method: "", verification: "document_verified" } });
    await page.goto(`/dashboard/plots/${p.id}/score`);
    await expect(page.locator("tr", { hasText: "Plot size (sq yd)" })).toContainText(`0 / ${weight}`); // far above the 1,200 ceiling
  });

  test("saving a decision needs reasons, and the saved score stays frozen when the rules change later", async ({ page, plot, request }) => {
    const { size, weight } = await residential(request);
    const p = await plot({ plot_no: "SC-FREEZE", size_sqyd: 300 });
    await claim(request, p.id, "document_verified");
    await page.goto(`/dashboard/plots/${p.id}/score`);

    await page.getByRole("button", { name: "+ Save a decision" }).click();
    await page.getByRole("button", { name: "Freeze score and save" }).click();
    await expect(page.getByText(/Write your reasons/)).toBeVisible();
    await page.getByRole("combobox", { name: "Decision" }).click();
    await page.getByRole("option", { name: "Hold" }).click();
    await page.getByPlaceholder("Why this decision?").fill("Waiting for the NOC");
    await page.getByRole("button", { name: "Freeze score and save" }).click();

    const snap = page.locator("li", { hasText: "Waiting for the NOC" });
    await expect(snap).toBeVisible();
    await expect(snap).toContainText("Hold");
    const before = (await headline(page).innerText()).split("/")[0].trim();
    await expect(snap).toContainText(`Score ${before}`);
    await snap.getByRole("button", { name: "Show frozen inputs" }).click();
    await expect(snap).toContainText("Plot size (sq yd)");

    try { // change the rules: the live score moves, the frozen one does not
      const r = await request.patch(`${API}/score/fields/${size.id}`, { data: { weight: weight + 12, lo_zero: size.lo_zero, lo_ideal: size.lo_ideal, hi_ideal: size.hi_ideal, hi_zero: size.hi_zero } });
      expect(r.ok(), await r.text()).toBeTruthy();
      await page.reload();
      const after = (await headline(page).innerText()).split("/")[0].trim();
      expect(after).not.toBe(before);
      await expect(page.locator("li", { hasText: "Waiting for the NOC" })).toContainText(`Score ${before}`);
    } finally {
      await request.patch(`${API}/score/fields/${size.id}`, { data: { weight, lo_zero: size.lo_zero, lo_ideal: size.lo_ideal, hi_ideal: size.hi_ideal, hi_zero: size.hi_zero } });
    }
  });

  test("switching the profile changes which rules the plot is scored by", async ({ page, plot }) => {
    const p = await plot({ plot_no: "SC-PROF" });
    await page.goto(`/dashboard/plots/${p.id}/score`);
    await page.getByRole("combobox", { name: "Profile" }).click();
    await page.getByRole("option", { name: "Commercial profile" }).click();
    await expect(page.getByRole("combobox", { name: "Profile" })).toContainText("Commercial profile");
    await page.goto(`/dashboard/plots/${p.id}`); // the summary on the plot page follows
    await expect(page.getByText("Commercial profile")).toBeVisible();
  });
});

test.describe("Ranking", () => {
  test("better-evidenced plots rank higher, and rejected plots are left out", async ({ page, plot, request }) => {
    const good = await plot({ plot_no: "RANK-GOOD", size_sqyd: 300 });
    await claim(request, good.id, "document_verified");
    await plot({ plot_no: "RANK-BARE", size_sqyd: 300 });
    const gone = await plot({ plot_no: "RANK-GONE", size_sqyd: 300 });
    await claim(request, gone.id, "document_verified");
    await request.patch(`${API}/plots/${gone.id}`, { data: { status: "rejected", reason: "Not for us" } });

    await page.goto("/dashboard/scorecard");
    await expect(page.locator("tbody tr", { hasText: "RANK-GOOD" })).toBeVisible(); // the ranking is worked out per plot, so wait for it
    const rows = await page.locator("tbody tr").allInnerTexts();
    const at = (t: string) => rows.findIndex((r) => r.includes(t));
    expect(at("RANK-GOOD")).toBeGreaterThanOrEqual(0);
    expect(at("RANK-BARE")).toBeGreaterThan(at("RANK-GOOD"));
    expect(at("RANK-GONE")).toBe(-1);
    await expect(page.getByText("Plots scored")).toBeVisible();
    await page.locator("tbody tr", { hasText: "RANK-GOOD" }).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/plots/${good.id}/score$`));
  });
});

test.describe("Scoring rules", () => {
  test("a changed weight shows Save, saves, and a band out of order is refused", async ({ page, request }) => {
    const { size, weight } = await residential(request);
    await page.goto("/dashboard/scorecard/rules");
    const w = page.getByLabel("Plot size (sq yd) weight").first();
    await expect(w).toHaveValue(String(weight));
    const row = page.locator("tr", { hasText: "Plot size (sq yd)" }).first();
    await expect(row.getByRole("button", { name: "Save" })).toHaveCount(0); // nothing changed yet

    try {
      await w.fill(String(weight + 5));
      await row.getByRole("button", { name: "Save" }).click();
      await expect.poll(async () => (await residential(request)).weight).toBe(weight + 5);
      await expect(row.getByRole("button", { name: "Save" })).toHaveCount(0); // the page has reloaded the saved rule

      await page.getByLabel("Plot size (sq yd) lo_zero").first().fill(String(size.lo_ideal + 50)); // the zero point above the ideal one
      await page.locator("tr", { hasText: "Plot size (sq yd)" }).first().getByRole("button", { name: "Save" }).click();
      await expect(page.getByText(/bands must run in order/)).toBeVisible();
    } finally {
      await request.patch(`${API}/score/fields/${size.id}`, { data: { weight, lo_zero: size.lo_zero, lo_ideal: size.lo_ideal, hi_ideal: size.hi_ideal, hi_zero: size.hi_zero } });
    }
  });

  test("each profile has its own bands", async ({ page }) => {
    await page.goto("/dashboard/scorecard/rules");
    const lo = page.getByLabel("Plot size (sq yd) lo_zero").first();
    await expect(lo).toHaveValue("100"); // Residential
    await page.getByRole("button", { name: "Commercial", exact: true }).click();
    await expect(lo).toHaveValue("150");
  });
});
