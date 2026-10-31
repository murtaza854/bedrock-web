import { API, expect, test } from "./fixtures";

// The calculator: a name, an area and a size, then the feasibility. The plot is added only when the result is saved.
async function through(page: any, { upper = true }: { upper?: boolean } = {}) {
  await page.getByRole("button", { name: "Next" }).click(); // Buildings
  await page.getByLabel("Ground floor (sq ft)").fill(upper ? "1650" : "1000");
  await page.getByLabel("Sale price per sq ft (PKR)").fill(upper ? "120000" : "100000");
  await page.getByRole("button", { name: "Next" }).click();
  if (upper) {
    await page.getByLabel("Number of floors above ground").fill("4");
    await page.getByLabel("Area of each floor (sq ft)").fill("2040");
    await page.getByLabel("Sale price per sq ft (PKR), offices").fill("30000");
  }
  await page.getByRole("button", { name: "Next" }).click();
  if (upper) {
    await page.getByLabel("Number of basement floors").fill("1");
    await page.getByLabel("Area of each basement floor (sq ft)").fill("1800");
    await page.getByRole("button", { name: "Next" }).click();
  } else await page.getByRole("button", { name: "No basement" }).click();
  await page.getByLabel("Construction cost per sq ft (PKR), same for every floor").fill(upper ? "7000" : "5000");
}

test.describe("Calculator", () => {
  test("a name, an area and a size lead to a feasibility; the plot is added when you save, with nothing else filled in", async ({ page, request }) => {
    await page.goto("/dashboard/calculator");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Give the plot a name or number")).toBeVisible();
    await expect(page.getByText("Enter the size in square yards")).toBeVisible();
    await page.getByPlaceholder("e.g. 174 & 176").fill("CALC-1");
    await page.getByRole("combobox", { name: "Area" }).fill("Calc Town");
    await page.getByRole("combobox", { name: "Area" }).press("Escape");
    await page.getByPlaceholder("e.g. 400").fill("200");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Plot is 200 sq yd")).toBeVisible();

    await through(page);
    await page.getByLabel("Land price in PKR").fill("300000000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Years").fill("2");
    await page.getByRole("button", { name: "Work it out" }).click();
    await expect(page.getByRole("row", { name: /^Revenue/ })).toContainText("442,800,000");
    await expect(page.getByRole("row", { name: /^Profit / }).first()).toContainText("61,530,000");

    const before = await (await request.get(`${API}/plots`)).json(); // nothing has been added yet
    expect(before.some((p: any) => p.plot_no === "CALC-1")).toBe(false);
    await page.getByRole("button", { name: "Save as a scenario" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots\/\d+$/);

    const plots = await (await request.get(`${API}/plots`)).json();
    const p = plots.find((x: any) => x.plot_no === "CALC-1");
    expect([p.area, p.size_sqyd]).toEqual(["Calc Town", 200]);
    const full = await (await request.get(`${API}/plots/${p.id}`)).json();
    expect(full.quotes).toHaveLength(0); // no quotes, facts or anything else were made
    expect(full.claims).toHaveLength(0);
    const models = await (await request.get(`${API}/plots/${p.id}/financial-models`)).json();
    expect(models).toHaveLength(1);
    expect(models[0].output.profit).toBe(61_530_000);
  });

  test("a name already used in that area is refused at save, and nothing is left behind", async ({ page, plot, request }) => {
    await plot({ area: "Calc Town", plot_no: "CALC-DUP" });
    await page.goto("/dashboard/calculator");
    await page.getByRole("combobox", { name: "Area" }).click();
    await expect(page.getByRole("option", { name: /^Calc Town/ }).first()).toContainText("used"); // an area you already have is offered first
    await page.getByRole("combobox", { name: "Area" }).press("Escape");
    await page.getByPlaceholder("e.g. 174 & 176").fill("CALC-DUP");
    await page.getByRole("combobox", { name: "Area" }).fill("Calc Town");
    await page.getByRole("combobox", { name: "Area" }).press("Escape");
    await page.getByPlaceholder("e.g. 400").fill("400");
    await page.getByRole("button", { name: "Start" }).click();
    await through(page, { upper: false });
    await page.getByLabel("Land price in PKR").fill("50000000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Years").fill("1");
    await page.getByRole("button", { name: "Work it out" }).click();
    await page.getByRole("button", { name: "Save as a scenario" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("already exists");
    const dup = (await (await request.get(`${API}/plots`)).json()).filter((p: any) => p.plot_no === "CALC-DUP");
    expect(dup).toHaveLength(1);
    expect(await (await request.get(`${API}/plots/${dup[0].id}/financial-models`)).json()).toHaveLength(0);
  });

  test("a calculation needs no saved plot on the API either", async ({ request }) => {
    const floor = { label: "Ground", floor_type: "ground", use: "shop", built_area_sqft: 1000, sellable_ratio: 1, ratio_verification: "claimed", price_mode: "per_sqft", price_per_sqft: 100000, fixed_unit_price: 0, unit_count: 0, price_basis_confirmed: false, price_verification: "claimed" };
    const r = await request.post(`${API}/financial/compute`, { data: { plot_area_sqyd: 200, floors: [floor], land_price: 50_000_000, land_verification: "claimed", construction_per_sqft: 5000, construction_covers: "unknown", construction_verification: "claimed", costs: [], target_margin: 0.2 } });
    expect(r.ok(), await r.text()).toBeTruthy();
    expect((await r.json()).output.profit).toBe(45_000_000);
    expect((await request.post(`${API}/financial/compute`, { data: { floors: [floor] } })).status()).toBe(400); // with no plot and no size there is nothing to go on
  });
});

test.describe("Taking the land price from a quote", () => {
  test("a plot with quotes offers them in a dropdown; choosing one copies its price and links to it; typing your own saves no quote", async ({ page, plot, request }) => {
    const p = await plot({ area: "Quote Town", size_sqyd: 200 });
    for (const [broker, price] of [["Ali", 630_000_000], ["Bilal", 620_000_000]] as const) await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker, quote_type: "asking", price_pkr: price, inclusions: "" } });
    const quotes = (await (await request.get(`${API}/plots/${p.id}`)).json()).quotes;
    const bilal = quotes.find((q: any) => q.broker === "Bilal");

    await page.goto(`/dashboard/plots/${p.id}/feasibility`);
    await through(page, { upper: false });
    await page.getByRole("combobox", { name: "Use a quote" }).click();
    await expect(page.getByRole("option", { name: "Ali, Asking, 630,000,000" })).toBeVisible();
    await page.getByRole("option", { name: "Bilal, Asking, 620,000,000" }).click();
    await expect(page.getByLabel("Land price in PKR")).toHaveValue("620,000,000"); // its price is copied in
    await page.getByLabel("Land price in PKR").fill("600000000"); // typing over it is your own number again
    await expect(page.getByRole("combobox", { name: "Use a quote" })).toContainText("Type my own");
    await page.getByRole("combobox", { name: "Use a quote" }).click();
    await page.getByRole("option", { name: "Bilal, Asking, 620,000,000" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Years").fill("1");
    await page.getByRole("button", { name: "Work it out" }).click();
    await page.getByRole("button", { name: "Save as a scenario" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots\/\d+$/);
    const [m] = await (await request.get(`${API}/plots/${p.id}/financial-models`)).json();
    expect([m.model.land_price_basis, m.model.land_quote_id, m.model.land_price]).toEqual(["specific", bilal.id, 620_000_000]);

    await page.goto(`/dashboard/plots/${p.id}/feasibility`); // a second scenario with a number typed by hand
    await through(page, { upper: false });
    await page.getByLabel("Scenario name").fill("Try");
    await page.getByLabel("Land price in PKR").fill("600000000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Years").fill("1");
    await page.getByRole("button", { name: "Work it out" }).click();
    await page.getByRole("button", { name: "Save as a scenario" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots\/\d+$/);
    const all = await (await request.get(`${API}/plots/${p.id}/financial-models`)).json();
    const typed = all.find((e: any) => e.model.name === "Try").model;
    expect([typed.land_price_basis, typed.land_quote_id, typed.land_price]).toEqual(["manual", null, 600_000_000]);
    expect((await (await request.get(`${API}/plots/${p.id}`)).json()).quotes).toHaveLength(2); // still just the two real quotes
  });
});
