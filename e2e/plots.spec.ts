import { API, expect, test } from "./fixtures";

test.describe("Add plot: area list", () => {
  test("offers used areas first, filters loosely, and accepts a new name", async ({ page, plot }) => {
    await plot({ area: "DHA Phase 6" });
    await page.goto("/dashboard/plots/new");
    const area = page.getByRole("combobox", { name: "Area" });
    await area.click();
    const mine = page.getByRole("option", { name: /^DHA Phase 6/ }).first(); // areas you have used are tagged, however many there are
    await expect(mine).toContainText("used");
    await expect(page.getByRole("option", { name: /^A Area Liaquatabad/ })).not.toContainText("used"); // a seed-list name that no plot uses
    const usedTags = await page.getByRole("option").filter({ hasText: "used" }).count();
    const firstUnused = await page.getByRole("option").evaluateAll((els) => els.findIndex((e) => !e.textContent!.includes("used")));
    expect(firstUnused).toBe(usedTags); // every used area is listed before any unused one

    await area.fill("gulshan e iq"); // loose spelling still finds the hyphenated name
    await expect(page.getByRole("option").first()).toHaveText("Gulshan-e-Iqbal");
    await area.press("Enter"); // picks the row and does not submit the form
    await expect(area).toHaveValue("Gulshan-e-Iqbal");
    await expect(page).toHaveURL(/plots\/new$/);

    await area.fill("Zzz Brand New Town");
    await expect(page.getByRole("option")).toHaveText(/Use Zzz Brand New Town as a new area/);
    await area.press("Escape");
    await page.locator('input[name="plot_no"]').fill("N-1");
    await page.getByRole("button", { name: "Add plot" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots$/);

    const plots = await (await page.request.get(`${API}/plots`)).json();
    expect(plots.some((p: any) => p.area === "Zzz Brand New Town" && p.plot_no === "N-1")).toBeTruthy();

    await page.goto("/dashboard/plots/new"); // the new area is now one of yours
    await area.click();
    await expect(page.getByRole("option", { name: /Zzz Brand New Town/ })).toContainText("used");
  });

  test("an empty area or plot number shows inline errors", async ({ page }) => {
    await page.goto("/dashboard/plots/new");
    await page.getByRole("button", { name: "Add plot" }).click();
    await expect(page.getByText("Enter an area")).toBeVisible();
    await expect(page.getByText("Enter a plot number")).toBeVisible();
  });
});

test.describe("Location pin", () => {
  test("a stray click on a new plot can be undone with Remove pin", async ({ page }) => {
    await page.goto("/dashboard/plots/new");
    const map = page.locator(".maplibregl-canvas");
    await map.click({ position: { x: 200, y: 140 } });
    await expect(page.getByText(/Pin at /)).toBeVisible();
    await expect(page.locator(".maplibregl-marker")).toHaveCount(1);
    await page.getByRole("button", { name: "Remove pin" }).click();
    await expect(page.locator(".maplibregl-marker")).toHaveCount(0);
    await expect(page.getByText(/leave it blank if you don't know/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove pin" })).toHaveCount(0);
  });

  test("removing the pin on an existing plot and saving clears its location", async ({ page, plot }) => {
    const p = await plot({ gps_lat: 24.81, gps_lon: 67.06 });
    await page.goto(`/dashboard/plots/${p.id}/edit`);
    await page.getByRole("button", { name: "Remove pin" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots$/);
    const saved = await (await page.request.get(`${API}/plots/${p.id}`)).json();
    expect(saved.plot.gps_lat).toBeNull();
    expect(saved.plot.gps_lon).toBeNull();
  });

  test("saving an unrelated change keeps the pin", async ({ page, plot }) => {
    const p = await plot({ gps_lat: 24.81, gps_lon: 67.06 });
    await page.goto(`/dashboard/plots/${p.id}/edit`);
    await page.locator('input[name="size"]').fill("500");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots$/);
    const saved = await (await page.request.get(`${API}/plots/${p.id}`)).json();
    expect([saved.plot.gps_lat, saved.plot.gps_lon, saved.plot.size_sqyd]).toEqual([24.81, 67.06, 500]);
  });
});
