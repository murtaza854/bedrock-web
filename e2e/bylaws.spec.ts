import { API, expect, test } from "./fixtures";

const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString("en-CA"); };

async function rule(request: any, data: Record<string, unknown>) {
  const r = await request.post(`${API}/bylaws`, { data: { use_type: "residential", effective_from: day(-30), source: "Test circular 1", notes: "", ...data } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
const buildable = (page: any) => page.locator("section", { has: page.getByRole("heading", { name: /^Buildable area/ }) });

test.describe("Adding a rule", () => {
  test("the form names every problem, then saves and lists the rule", async ({ page }) => {
    await page.goto("/dashboard/bylaws/new");
    await page.getByRole("button", { name: "Save rule" }).click();
    await expect(page.getByText("Which area does the rule apply to?")).toBeVisible();
    await expect(page.getByText("Name the circular, clause or page it comes from")).toBeVisible();
    await expect(page.getByText(/Enter at least one limit/)).toBeVisible();

    await page.locator('input[name="area"]').fill("Formville");
    await page.locator('input[name="source"]').fill("Circular 7, clause 2");
    await page.locator('input[name="max_coverage_pct"]').fill("150");
    await page.locator('input[name="min_sqyd"]').fill("500");
    await page.locator('input[name="max_sqyd"]').fill("300");
    await page.getByRole("button", { name: "Save rule" }).click();
    await expect(page.getByText("Between 0 and 100")).toBeVisible();
    await expect(page.getByText("Must be above the smallest size")).toBeVisible();

    await page.locator('input[name="max_coverage_pct"]').fill("60");
    await page.locator('input[name="max_sqyd"]').fill("1000");
    await page.locator('input[name="far"]').fill("1.5");
    await page.getByRole("button", { name: "Save rule" }).click();
    await expect(page).toHaveURL(/\/dashboard\/bylaws$/);
    const row = page.locator("tbody tr", { hasText: "Formville" });
    await expect(row).toContainText("500 to 1000 sq yd");
    await expect(row).toContainText("1.5");
    await expect(row).toContainText("60%");
    await expect(row).toContainText("Circular 7, clause 2");
    await expect(row).toContainText("In force");
    await expect(row).toContainText("Not confirmed"); // nothing counts as confirmed until you say so
  });

  test("the add-a-rule link from a plot with no rule pre-fills the area", async ({ page, plot }) => {
    const p = await plot({ area: "Prefillton", plot_no: "BY-NONE", size_sqyd: 400 });
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(buildable(page)).toContainText("No bylaw rule matches Prefillton");
    await buildable(page).getByRole("link", { name: "Add the rule" }).click();
    await expect(page).toHaveURL(/bylaws\/new\?area=Prefillton/);
    await expect(page.locator('input[name="area"]')).toHaveValue("Prefillton");
  });
});

test.describe("Buildable area on a plot", () => {
  test("shows the covered area, what limits it, and the working", async ({ page, plot, request }) => {
    await rule(request, { area: "Workton", far: 1.5, max_coverage_pct: 60, max_floors: 3, source: "Workton circular" });
    const p = await plot({ area: "Workton", plot_no: "BY-1", size_sqyd: 500 }); // 4,500 sq ft: FAR allows 6,750; coverage x floors allows 8,100
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(buildable(page)).toContainText("6,750");
    await expect(buildable(page)).toContainText("limited by the floor area ratio");
    await expect(buildable(page)).toContainText("Rule: Workton circular");
    await buildable(page).getByRole("button", { name: "Show the working" }).click();
    await expect(buildable(page)).toContainText("Plot area");
    await expect(buildable(page)).toContainText("Floor area ratio limit");
    await expect(buildable(page)).toContainText("Ground coverage limit");
  });

  test("an unconfirmed rule is used but flagged on the plot until you confirm it with the authority", async ({ page, plot, request }) => {
    const r = await rule(request, { area: "Confirmville", far: 2, source: "Confirm circular" });
    const p = await plot({ area: "Confirmville", plot_no: "BY-CONF", size_sqyd: 400 });
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(buildable(page)).toContainText("not been confirmed with the authority");

    await page.goto("/dashboard/bylaws");
    await page.locator("tbody tr", { hasText: "Confirmville" }).getByRole("button", { name: "Mark confirmed" }).click();
    await expect(page.locator("tbody tr", { hasText: "Confirmville" })).toContainText("Confirmed");
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(buildable(page)).toContainText("7,200"); // 3,600 sq ft x FAR 2
    await expect(buildable(page)).not.toContainText("not been confirmed");
    expect(r.id).toBeGreaterThan(0);
  });

  test("a newer rule replaces an older one; the history keeps both", async ({ page, plot, request }) => {
    await rule(request, { area: "Newerton", far: 1, effective_from: day(-400), source: "Old circular" });
    await rule(request, { area: "Newerton", far: 2, effective_from: day(-10), source: "New circular" });
    const p = await plot({ area: "Newerton", plot_no: "BY-NEW", size_sqyd: 500 });
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(buildable(page)).toContainText("Rule: New circular");
    await expect(buildable(page)).toContainText("9,000"); // 4,500 sq ft x FAR 2

    await page.goto("/dashboard/bylaws");
    await expect(page.locator("tbody tr", { hasText: "Old circular" })).toHaveCount(0); // superseded rules are hidden by default
    await page.getByRole("button", { name: "Show history" }).click();
    await expect(page.locator("tbody tr", { hasText: "Old circular" })).toContainText("Superseded");
    await expect(page.locator("tbody tr", { hasText: "New circular" })).toContainText("In force");
  });

  test("a rule that takes effect in the future does not apply yet", async ({ page, plot, request }) => {
    await rule(request, { area: "Futureville", far: 3, effective_from: day(60), source: "Future circular" });
    const p = await plot({ area: "Futureville", plot_no: "BY-FUT", size_sqyd: 400 });
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(buildable(page)).toContainText("No bylaw rule matches Futureville");
    await page.goto("/dashboard/bylaws");
    await expect(page.locator("tbody tr", { hasText: "Future circular" })).toContainText("Not yet in force");
  });

  test("voiding needs a reason, removes the rule from use, and keeps it in the history", async ({ page, plot, request }) => {
    await rule(request, { area: "Voidton", far: 2, source: "Void circular" });
    const p = await plot({ area: "Voidton", plot_no: "BY-VOID", size_sqyd: 400 });
    await page.goto("/dashboard/bylaws");
    const row = page.locator("tbody tr", { hasText: "Void circular" });
    await row.getByRole("button", { name: "Void", exact: true }).click();
    await page.locator("form").getByRole("button", { name: "Void" }).click();
    await expect(page.getByText("Say why")).toBeVisible();
    await page.getByPlaceholder("Reason").fill("Superseded by a corrected circular");
    await page.locator("form").getByRole("button", { name: "Void" }).click();
    await expect(page.locator("tbody tr", { hasText: "Void circular" })).toHaveCount(0);

    await page.getByRole("button", { name: "Show history" }).click();
    await expect(page.locator("tbody tr", { hasText: "Void circular" })).toContainText("Voided: Superseded by a corrected circular");
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(buildable(page)).toContainText("No bylaw rule matches Voidton");
  });

  test("plots with no matching rule are listed on the bylaws page", async ({ page, plot }) => {
    await plot({ area: "Ruleless", plot_no: "BY-LISTED", size_sqyd: 400 });
    await page.goto("/dashboard/bylaws");
    const missing = page.locator("section", { has: page.getByRole("heading", { name: "Plots with no matching rule" }) });
    await expect(missing).toContainText("BY-LISTED");
    await expect(missing.locator("li", { hasText: "BY-LISTED" }).getByRole("link", { name: "Add a rule →" })).toHaveAttribute("href", /area=Ruleless/);
  });
});
