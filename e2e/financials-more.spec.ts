import { API, expect, test } from "./fixtures";

// A saved one-floor model: 3,000 sq ft ground floor at `groundPrice` a sq ft, construction 6,000 a sq ft, land 100,000,000.
// Revenue 3,000 x groundPrice; cost 18,000,000 + 100,000,000.
async function model(request: any, plotId: number, name: string, groundPrice: number, land = 100_000_000) {
  const m = await (await request.post(`${API}/plots/${plotId}/financial-models`, { data: { name, scenario_label: name.toLowerCase() } })).json();
  const floors = [{ label: "Ground", floor_type: "ground", use: "shop", built_area_sqft: 3000, sellable_ratio: 1, price_mode: "per_sqft", price_per_sqft: groundPrice, unit_count: 0, fixed_unit_price: 0 }];
  const r = await request.put(`${API}/financial-models/${m.id}`, { data: { ...m, floors, construction_per_sqft: 6000, land_price: land, land_price_basis: "manual", target_margin: 0.2 } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return m;
}
const result = (page: any) => page.locator("section", { has: page.getByRole("heading", { name: /^Result/ }) });
const tab = (page: any, name: string | RegExp) => page.getByRole("button", { name });
const open = (page: any, plotId: number) => page.goto(`/dashboard/plots/${plotId}/financials`);

test.describe("Scenarios", () => {
  test("duplicate copies the floors and prices; make primary moves the star; delete asks first", async ({ page, plot, request }) => {
    const p = await plot({});
    await model(request, p.id, "Base", 120_000);
    await open(page, p.id);
    await expect(tab(page, /^Base ★/)).toBeVisible(); // the first scenario is primary
    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByLabel("Scenario name")).toHaveValue("Base (copy)");
    await expect(page.getByLabel("Built area")).toHaveCount(1);
    await expect(page.getByLabel("Price per sq ft", { exact: true })).toHaveValue("120000");
    await expect(tab(page, /^Base ★/)).toBeVisible(); // the copy is not primary

    await page.getByRole("button", { name: "Make primary" }).click();
    await expect(tab(page, /^Base \(copy\) ★/)).toBeVisible();
    await expect(page.getByText("Primary: the scorecard reads this one.")).toBeVisible();
    await expect(tab(page, /^Base ★/)).toHaveCount(0);

    page.once("dialog", (d) => d.dismiss()); // cancelling keeps it
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByLabel("Scenario name")).toHaveValue("Base (copy)");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(tab(page, /^Base \(copy\)/)).toHaveCount(0);
    await expect(tab(page, /^Base/)).toBeVisible();
  });

  test("compare puts two saved scenarios side by side", async ({ page, plot, request }) => {
    const p = await plot({});
    await model(request, p.id, "Demand", 120_000); // revenue 360m, cost 118m, profit 242m
    await model(request, p.id, "Try", 100_000); // revenue 300m, profit 182m
    await open(page, p.id);
    await tab(page, /^Demand/).click();
    await expect(page.getByText("Choose a scenario")).toBeVisible();
    await page.getByRole("combobox", { name: "Compare with" }).click();
    await page.getByRole("option", { name: "Try" }).click();
    const table = page.locator("table", { hasText: "Margin on cost" });
    await expect(table).toContainText("Demand (saved)");
    await expect(table.locator("tr", { hasText: "Profit" })).toContainText("24.20 crore");
    await expect(table.locator("tr", { hasText: "Profit" })).toContainText("18.20 crore");
    await expect(table.locator("tr", { hasText: "Revenue" })).toContainText("36.00 crore");
    await expect(table.locator("tr", { hasText: "Revenue" })).toContainText("30.00 crore");
  });

  test("a plot with no size cannot be modelled yet", async ({ page, plot }) => {
    const p = await plot({ size_sqyd: null });
    await open(page, p.id);
    await expect(page.getByText("This plot has no size yet.")).toBeVisible();
    await page.getByPlaceholder("New scenario").fill("Nope");
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
    await expect(page.getByText("Set the plot size first, then add a scenario.")).toBeVisible();
  });
});

test.describe("Inputs", () => {
  test("fixed-price units: five apartments at 130 million each", async ({ page, plot, request }) => {
    const p = await plot({});
    await model(request, p.id, "Apartments", 0);
    await open(page, p.id);
    await page.getByRole("combobox", { name: "Price mode" }).click();
    await page.getByRole("option", { name: "Fixed per unit" }).click();
    await page.getByLabel("Price per unit").fill("130000000");
    await page.getByLabel("Units", { exact: true }).fill("5");
    await expect(result(page)).toContainText("65.00 crore"); // revenue 650,000,000
    await expect(page.getByLabel("Price per sq ft", { exact: true })).toHaveCount(0); // the per-sq-ft box is gone
  });

  test("a percentage cost on land lowers the residual land price and the profit", async ({ page, plot, request }) => {
    const p = await plot({});
    // golden-style numbers: revenue 81 crore, construction 10.8 crore, land 63 crore
    const m = await (await request.post(`${API}/plots/${p.id}/financial-models`, { data: { name: "Pct", scenario_label: "pct" } })).json();
    const upper = Array.from({ length: 5 }, (_, i) => ({ label: `Floor ${i + 1}`, floor_type: "upper", use: "office", built_area_sqft: 3000, sellable_ratio: 1, price_mode: "per_sqft", price_per_sqft: 30_000, unit_count: 0, fixed_unit_price: 0 }));
    const ground = { label: "Ground", floor_type: "ground", use: "shop", built_area_sqft: 3000, sellable_ratio: 1, price_mode: "per_sqft", price_per_sqft: 120_000, unit_count: 0, fixed_unit_price: 0 };
    await request.put(`${API}/financial-models/${m.id}`, { data: { ...m, floors: [ground, ...upper], construction_per_sqft: 6000, land_price: 630_000_000, land_price_basis: "manual", target_margin: 0.2 } });
    await open(page, p.id);
    await expect(result(page)).toContainText("56.70 crore"); // residual land with no other costs
    await expect(result(page)).toContainText("7.20 crore"); // profit

    await page.getByLabel("Rate in percent").first().fill("4"); // the "Land transfer and stamp duty" template, 4% of land
    await expect(result(page)).toContainText("54.52 crore"); // 567 / 1.04
    await expect(result(page)).toContainText("4.68 crore"); // 7.20 less 4% of 63 crore (2.52)
    await expect(result(page)).toContainText("other 2.52 crore");
  });

  test("land price shortcuts take the lowest, median or latest quote", async ({ page, plot, request }) => {
    const p = await plot({});
    for (const [broker, price] of [["Cheap", 550_000_000], ["Dear", 650_000_000]] as const)
      await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker, quote_type: "asking", price_pkr: price, inclusions: "" } });
    await model(request, p.id, "Land", 120_000, 1);
    await open(page, p.id);
    await page.getByRole("button", { name: /^Median/ }).click();
    await expect(page.getByText("using PKR 600,000,000")).toBeVisible();
    await page.getByRole("button", { name: /^Lowest/ }).click();
    await expect(page.getByText("using PKR 550,000,000")).toBeVisible();
    await page.getByRole("combobox", { name: "Land price basis" }).click();
    await page.getByRole("option", { name: "A specific quote" }).click();
    await page.getByRole("combobox", { name: "Quote" }).click();
    await page.getByRole("option", { name: /Dear/ }).click();
    await expect(page.getByText("using PKR 650,000,000")).toBeVisible();
  });
});

test.describe("Warnings and guards", () => {
  test("confirming what the sale price is per clears that warning, and the confidence line says what is unverified", async ({ page, plot, request }) => {
    const p = await plot({});
    await model(request, p.id, "Warn", 120_000);
    await open(page, p.id);
    await expect(page.getByText(/not confirmed whether the sale price is per built or per sellable/)).toBeVisible();
    await expect(page.getByText(/sellable share is assumed/)).toBeVisible();
    await expect(page.getByText(/not known what the construction rate covers/)).toBeVisible();
    await expect(page.getByText("Built entirely on unverified claims")).toBeVisible();

    await page.getByLabel(/Per sellable sq ft confirmed/).check();
    await expect(page.getByText(/not confirmed whether the sale price is per built or per sellable/)).toHaveCount(0);
    await page.getByRole("combobox", { name: "What the construction rate covers" }).click();
    await page.getByRole("option", { name: "Finished" }).click();
    await expect(page.getByText(/not known what the construction rate covers/)).toHaveCount(0);
  });

  test("an unsaved edit blocks snapshots and duplicating until it is saved", async ({ page, plot, request }) => {
    const p = await plot({});
    await model(request, p.id, "Dirty", 120_000);
    await open(page, p.id);
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await page.getByLabel("Price per sq ft", { exact: true }).fill("125000");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Duplicate" })).toBeDisabled();
    await expect(page.getByText("Save your changes first.")).toBeVisible();
    await page.getByPlaceholder("Why are you saving this?").fill("Trying 125k");
    await expect(page.getByRole("button", { name: "Save snapshot" })).toBeDisabled();

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save snapshot" })).toBeEnabled();
    await page.getByRole("button", { name: "Save snapshot" }).click();
    await expect(page.getByText("Trying 125k")).toBeVisible();
  });

  test("saving an invalid model is refused with the fields marked", async ({ page, plot, request }) => {
    const p = await plot({});
    await model(request, p.id, "Invalid", 120_000);
    await open(page, p.id);
    await page.getByLabel("Built area").fill("0");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Fix the highlighted fields to save.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled(); // still unsaved
  });

  test("the sellable share is capped at 1 and a share below 1 lowers revenue", async ({ page, plot, request }) => {
    const p = await plot({});
    await model(request, p.id, "Share", 120_000); // revenue 360 million at a share of 1
    await open(page, p.id);
    await expect(result(page)).toContainText("36.00 crore");
    await page.getByLabel("Sellable share", { exact: true }).fill("0.8");
    await expect(result(page)).toContainText("28.80 crore"); // 360m x 0.8
    await page.getByLabel("Sellable share", { exact: true }).fill("1.5");
    await expect(page.getByText("must be between 0 and 1").first()).toBeVisible(); // listed at the top and under the field
  });
});
