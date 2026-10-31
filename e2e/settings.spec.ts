import { API, bought, expect, test } from "./fixtures";

const today = () => new Date().toLocaleDateString("en-CA");
const resetSettings = (request: any) => request.put(`${API}/admin/settings`, { data: { project_name: "", spread_alert_pct: "", stale_quote_days: "" } });
const item = (page: any, label: string) => page.locator("li", { hasText: label });

test.describe("Settings", () => {
  test("shows the numbers behind the alerts with their defaults", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    const spread = item(page, "Broker gap alert");
    await expect(spread).toContainText("Default 10");
    await expect(spread.locator("input")).toHaveValue("10");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled(); // nothing changed yet
    await expect(page.getByText("Switched off (development)")).toBeVisible(); // this server runs without sign-in
    await expect(page.getByText("Asia/Karachi")).toBeVisible();
  });

  test("a number outside its range is refused with the allowed range", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await item(page, "Broker gap alert").locator("input").fill("0");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("A whole number from 1 to 100")).toBeVisible();
    await item(page, "Broker gap alert").locator("input").fill("12.5");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("A whole number from 1 to 100")).toBeVisible();
  });

  test("saving changes the project name in the sidebar, marks a rule Changed, and Use the default undoes it", async ({ page, request }) => {
    try {
      await page.goto("/dashboard/settings");
      await page.getByPlaceholder("Shown under Bedrock").fill("Karachi Plots");
      await item(page, "A quote is out of date after").locator("input").fill("45");
      await expect(page.getByText("2 unsaved")).toBeVisible();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved. The whole app uses these now.")).toBeVisible();
      await expect(page.getByRole("complementary").getByText("Karachi Plots")).toBeVisible();
      await expect(item(page, "A quote is out of date after")).toContainText("Changed");

      await page.reload(); // it persists
      await expect(page.getByPlaceholder("Shown under Bedrock")).toHaveValue("Karachi Plots");
      await item(page, "A quote is out of date after").getByRole("button", { name: "Use the default" }).click();
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved. The whole app uses these now.")).toBeVisible();
      await expect(item(page, "A quote is out of date after")).not.toContainText("Changed");
    } finally { await resetSettings(request); }
  });

  test("the broker-disagreement setting really decides whether a plot is flagged", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "SET-SPREAD", size_sqyd: 400 });
    for (const [broker, price] of [["Low Broker", 560_000_000], ["High Broker", 700_000_000]] as const) // a 25% spread
      await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker, quote_type: "asking", price_pkr: price, inclusions: "" } });
    try {
      await page.goto(`/dashboard/plots/${p.id}`);
      await expect(page.getByText(/Brokers differ by 25%/)).toBeVisible(); // alert at 10% or more
      await request.put(`${API}/admin/settings`, { data: { spread_alert_pct: "40" } });
      await page.reload();
      await expect(page.getByText(/Brokers differ by 25%/)).toHaveCount(0); // 25% is now under the alert
    } finally { await resetSettings(request); }
  });

  test("links to the rules that live elsewhere", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("link", { name: "Scoring rules" })).toHaveAttribute("href", "/dashboard/scorecard/rules");
    await expect(page.getByRole("link", { name: "Tax and fee rates" })).toHaveAttribute("href", "/dashboard/settings/rates");
    await expect(page.getByRole("main").getByRole("link", { name: "Bylaws" })).toHaveAttribute("href", "/dashboard/bylaws");
  });
});

test.describe("Tax and fee rates", () => {
  test("every rate starts Not set; setting one needs a value, then shows it with its date", async ({ page }) => {
    await page.goto("/dashboard/settings/rates");
    const cvt = item(page, "Capital value tax");
    await expect(cvt).toContainText("Not set");
    await expect(cvt).toContainText("counts as zero");
    await cvt.getByRole("button", { name: "Set" }).click();
    await page.getByRole("button", { name: "Save rate" }).click();
    await expect(page.getByText("Enter a rate, 0 or more")).toBeVisible();

    await page.locator('input[name="value"]').fill("2.5");
    await page.locator('input[name="note"]').fill("Finance Act circular");
    await page.getByRole("button", { name: "Save rate" }).click();
    await expect(cvt).toContainText("2.5%");
    await expect(cvt).toContainText(`since`);
    await expect(cvt).toContainText("Finance Act circular");
    await expect(cvt).not.toContainText("Not set");
  });

  test("updating a rate keeps the old one in its history", async ({ page, request }) => {
    for (const [value, effective_from] of [[1, "2024-01-01"], [3, "2025-06-01"]] as const)
      await request.post(`${API}/rates`, { data: { key: "legal_fee", value: value * 1000, effective_from, note: `v${value}` } });
    await page.goto("/dashboard/settings/rates");
    const row = item(page, "Legal and documentation");
    await expect(row).toContainText("PKR 3,000"); // the latest one that has taken effect
    await row.getByRole("button", { name: "History" }).click();
    await expect(row).toContainText("PKR 1,000");
    await expect(row).toContainText("v1");
  });

  test("a percentage above 100 is refused", async ({ page }) => {
    await page.goto("/dashboard/settings/rates");
    await item(page, "Withholding or advance tax").getByRole("button", { name: "Set" }).click();
    await page.locator('input[name="value"]').fill("150");
    await page.getByRole("button", { name: "Save rate" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("percentages up to 100");
  });

  test("a confirmed rate can be added to a financial model from the rate table", async ({ page, plot, request }) => {
    await request.post(`${API}/rates`, { data: { key: "stamp_duty", value: 2, effective_from: "2024-01-01", note: "from the rate table test" } });
    const p = await plot({ plot_no: "RATE-FIN" });
    await bought(request, p.id);
    await page.goto(`/dashboard/plots/${p.id}/financials`);
    await page.getByPlaceholder("New scenario").fill("With rates");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByLabel("Scenario name")).toHaveValue("With rates");
    const before = await page.getByLabel("Cost basis").count();
    await page.getByRole("combobox", { name: "Add from rate table" }).click();
    await page.getByRole("option", { name: "Stamp duty" }).click();
    await expect(page.getByRole("combobox", { name: "Cost basis" })).toHaveCount(before + 1);
    await expect(page.getByLabel("Cost 9 label")).toHaveValue("Stamp duty");
    await expect(page.getByLabel("Rate in percent").last()).toHaveValue("2"); // a buying cost, as a percentage of land
  });
});
