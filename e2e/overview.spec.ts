import { API, expect, test } from "./fixtures";

const quote = (request: any, plotId: number, broker: string, quote_type: string, price_pkr: number) =>
  request.post(`${API}/plots/${plotId}/quotes`, { data: { broker, quote_type, price_pkr, inclusions: "" } });
const kpi = (page: any, name: string) => page.locator("div", { has: page.locator("p", { hasText: new RegExp(`^${name}$`) }) }).last();
const section = (page: any, heading: string) => page.locator("section", { has: page.getByRole("heading", { name: heading }) });

// Three 400 sq yd plots, each with an asking and a confirmed quote. Asking per sq yd: 200,000 / 220,000 / 240,000.
// Confirmed per sq yd: 180,000 / 190,000 / 200,000.
async function pricedArea(plot: any, request: any, area: string) {
  const asks = [80, 88, 96], confirmed = [72, 76, 80], plots = [];
  for (let i = 0; i < 3; i++) {
    const p = await plot({ area, plot_no: `OV-${i + 1}`, size_sqyd: 400 });
    await quote(request, p.id, `Seller ${i + 1}`, "asking", asks[i] * 1_000_000);
    await quote(request, p.id, `Buyer ${i + 1}`, "owner_confirmed", confirmed[i] * 1_000_000);
    plots.push(p);
  }
  return plots;
}

test.describe("Numbers", () => {
  test("medians, the asking-to-confirmed gap and quote counts follow the quotes", async ({ page, plot, request }) => {
    await pricedArea(plot, request, "Overviewland");
    await page.goto("/dashboard?area=Overviewland");
    await expect(page.getByText("3 plots match")).toBeVisible();
    await expect(kpi(page, "Median asking / sq yd")).toContainText("220,000");
    await expect(kpi(page, "Median confirmed / sq yd")).toContainText("190,000");
    await expect(kpi(page, "Asking to confirmed")).toContainText("-14%"); // 1 - 190/220
    await expect(kpi(page, "Quotes this week")).toContainText("6");

    const areas = section(page, "Areas");
    await expect(areas).toContainText("Overviewland");
    await expect(areas).toContainText("220,000");
    await expect(areas).toContainText("190,000");
    await expect(areas).toContainText("-14%");
    await expect(section(page, "Quote activity")).toContainText("6 quotes");

    const sizes = section(page, "Price by plot size"); // a 400 sq yd plot sits in the 250 to 499 band
    const band = sizes.locator("tr", { hasText: "250-499" });
    await expect(band).toContainText("200,000"); // the median of all six quotes: 180, 190, 200, 200, 220, 240 thousand
    await expect(band.locator("td").nth(1)).toHaveText("3"); // plots
    await expect(band.locator("td").nth(2)).toHaveText("6"); // quotes
  });

  test("with fewer quotes than the minimum sample, it says not enough data instead of a number", async ({ page, plot, request }) => {
    const p = await plot({ area: "Thinland", plot_no: "TH-1", size_sqyd: 400 });
    await quote(request, p.id, "Only Broker", "asking", 80_000_000);
    await page.goto("/dashboard?area=Thinland");
    await expect(kpi(page, "Median asking / sq yd")).toContainText("not enough data");
    await expect(kpi(page, "Asking to confirmed")).toContainText("-");
  });

  test("data-quality meters count what each plot has", async ({ page, plot, request }) => {
    const a = await plot({ area: "Qualland", plot_no: "Q-A", size_sqyd: 400, gps_lat: 24.8, gps_lon: 67.05 });
    await plot({ area: "Qualland", plot_no: "Q-B", size_sqyd: null });
    await quote(request, a.id, "Q Broker", "asking", 80_000_000);
    await page.goto("/dashboard?area=Qualland");
    const q = section(page, "Data quality");
    await expect(q.locator("div", { hasText: /^Has size/ }).first()).toContainText("1/2 · 50%");
    await expect(q.locator("div", { hasText: /^Has a quote/ }).first()).toContainText("1/2 · 50%");
    await expect(q.locator("div", { hasText: /^Has GPS/ }).first()).toContainText("1/2 · 50%");
    await expect(q.locator("div", { hasText: /^Two or more brokers/ }).first()).toContainText("0/2 · 0%");
  });
});

test.describe("Needs attention", () => {
  test("lists plots with no quotes, brokers who disagree, and unverified claims, each with its reason", async ({ page, plot, request }) => {
    await plot({ area: "Attnland", plot_no: "AT-NOQ" });
    const wide = await plot({ area: "Attnland", plot_no: "AT-WIDE" });
    await quote(request, wide.id, "Low", "asking", 560_000_000);
    await quote(request, wide.id, "High", "asking", 700_000_000);
    await request.post(`${API}/plots/${wide.id}/claims`, { data: { field: "corner", value: "yes", source: "broker", method: "", verification: "claimed" } });

    await page.goto("/dashboard?area=Attnland");
    const att = section(page, "Needs attention");
    await expect(att.locator("li", { hasText: "AT-NOQ" })).toContainText("No quotes");
    await expect(att.locator("li", { hasText: "AT-WIDE" }).first()).toContainText("Brokers differ by 25%");
    await expect(att).toContainText("1 unverified claim");
    await att.getByRole("link", { name: /AT-NOQ/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots\/\d+$/);
  });

  test("says so when nothing needs attention", async ({ page, plot, request }) => {
    const p = await plot({ area: "Calmland", plot_no: "CALM-1", size_sqyd: 400 });
    await quote(request, p.id, "Calm Broker", "asking", 80_000_000);
    await page.goto("/dashboard?area=Calmland");
    await expect(section(page, "Needs attention")).toContainText("Nothing needs attention.");
  });
});

test.describe("Filters", () => {
  test("choosing an area filters the figures, keeps the choice in the address, and Clear filters undoes it", async ({ page, plot, request }) => {
    await pricedArea(plot, request, "Filterland");
    await plot({ area: "Otherland", plot_no: "OTHER-1" });
    await page.goto("/dashboard");
    await page.getByRole("combobox", { name: "Area" }).click();
    await page.getByRole("option", { name: "Filterland" }).click();
    await expect(page.getByText("3 plots match")).toBeVisible();
    await expect(page).toHaveURL(/\?area=Filterland$/);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("3 plots match")).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the status filter narrows to plots in that status", async ({ page, request }) => {
    const mk = async (no: string, status: string) => {
      const p = await (await request.post(`${API}/plots`, { data: { area: "Statusland", plot_no: no, size_sqyd: 400 } })).json();
      if (status !== "new") await request.patch(`${API}/plots/${p.id}`, { data: { status } });
    };
    await mk("S-NEW", "new"); await mk("S-SHORT", "shortlisted"); await mk("S-NEG", "negotiating");
    await page.goto("/dashboard?area=Statusland");
    await expect(page.getByText("3 plots match")).toBeVisible();
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Shortlisted" }).click();
    await expect(page.getByText("1 plot match")).toBeVisible();
    await expect(page).toHaveURL(/status=shortlisted/);
  });

  test("a filter that matches nothing offers to clear itself", async ({ page }) => {
    await page.goto("/dashboard?area=No%20Such%20Area");
    await expect(page.getByText("No plots match these filters.")).toBeVisible();
    await page.getByRole("button", { name: "Clear the filters" }).click();
    await expect(page.getByText("No plots match these filters.")).toHaveCount(0);
  });

  test("a filter the API does not accept shows a readable error", async ({ page, request }) => {
    const r = await request.get(`${API}/stats?status=bogus`);
    expect(r.status()).toBe(400);
    expect(await r.text()).toContain("not valid");
    await page.goto("/dashboard?status=bogus");
    await expect(page.getByText(/Could not load analytics/)).toBeVisible();
  });
});
