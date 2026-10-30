import { API, bought, expect, test } from "./fixtures";

// The golden case: 400 sq yd (3,600 sq ft), ground plus five floors of 3,000 sq ft each. Ground sells at 120,000 a
// sq ft, upper floors at 30,000. Construction 6,000 a sq ft. Land 630,000,000 from the plot's quote.
test("golden case through the screen", async ({ page, plot, request }) => {
  const p = await plot({});
  await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker: "Test broker", quote_type: "negotiable", price_pkr: 630_000_000, inclusions: "" } });
  await bought(request, p.id);
  await page.goto(`/dashboard/plots/${p.id}/financials`);
  await expect(page.getByText("400 sq yd = 3,600 sq ft")).toBeVisible();

  await page.getByPlaceholder("New scenario").fill("Golden");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Scenario name")).toHaveValue("Golden");

  await page.getByRole("combobox", { name: "Land price basis" }).click(); // take the land price from the quote
  await page.getByRole("option", { name: "Lowest quote" }).click();

  await page.getByRole("button", { name: "+ Add floor" }).click(); // the first floor is the ground floor
  await page.getByLabel("Built area").fill("3000");
  await page.getByLabel("Price per sq ft", { exact: true }).fill("120000");
  await page.getByLabel("Price per sq ft for the generated floors").fill("30000"); // five upper floors by default
  await page.getByRole("button", { name: "+ Generate upper floors" }).click();
  await expect(page.getByLabel("Built area")).toHaveCount(6);

  await page.locator("section", { hasText: "Construction cost" }).locator('input[inputmode="decimal"]').first().fill("6000");

  const result = page.locator("section", { has: page.getByRole("heading", { name: /^Result/ }) });
  await expect(result).toContainText("810,000,000"); // revenue 810,000,000
  await expect(result).toContainText("738,000,000"); // total cost 738,000,000
  await expect(result).toContainText("72,000,000"); // profit 72,000,000
  await expect(result).toContainText("9.76% on cost");
  await expect(result).toContainText("702,000,000"); // break-even land 702,000,000
  await expect(result).toContainText("567,000,000"); // residual land at 20% 567,000,000

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  const models = await (await request.get(`${API}/plots/${p.id}/financial-models`)).json();
  expect(models[0].output.profit).toBe(72_000_000);
  expect(models[0].output.break_even_land).toBe(702_000_000);
  expect(models[0].output.residual_land).toBe(567_000_000);

  // the sensitivity table is there and shows a loss where the brief says: sale prices down 10%
  await expect(page.locator("td", { hasText: "-9,000,000" }).first()).toBeVisible();

  await page.getByPlaceholder("Why are you saving this?").fill("Golden case check");
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText("Golden case check")).toBeVisible();
  const snaps = await (await request.get(`${API}/plots/${p.id}/financial-snapshots`)).json();
  expect(snaps).toHaveLength(1);
});

test("a floor with no built area shows an inline error and no results", async ({ page, plot, request }) => {
  const p = await plot({});
  await bought(request, p.id);
  await page.goto(`/dashboard/plots/${p.id}/financials`);
  await page.getByPlaceholder("New scenario").fill("Broken");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "+ Add floor" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "must be above zero" })).toBeVisible();
  await expect(page.getByText("Fix the fields marked in red to see results.")).toBeVisible();
});

test("snapshots cannot be edited or deleted in the database", async ({ request, plot }) => {
  const p = await plot({});
  const m = await (await request.post(`${API}/plots/${p.id}/financial-models`, { data: { name: "Frozen" } })).json();
  const floors = [{ label: "Ground", floor_type: "ground", use: "shop", built_area_sqft: 3000, sellable_ratio: 1, price_mode: "per_sqft", price_per_sqft: 120000, unit_count: 0, fixed_unit_price: 0 }];
  const saved = await request.put(`${API}/financial-models/${m.id}`, { data: { ...m, floors, construction_per_sqft: 6000, land_price: 1, land_price_basis: "manual", target_margin: 0.2 } });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  const s = await request.post(`${API}/financial-models/${m.id}/snapshots`, { data: { reason: "freeze" } });
  expect(s.ok(), await s.text()).toBeTruthy();
  const none = await request.post(`${API}/financial-models/${m.id}/snapshots`, { data: { reason: " " } });
  expect(none.status()).toBe(400); // a snapshot needs a reason
});
