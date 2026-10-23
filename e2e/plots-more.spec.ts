import { API, expect, test } from "./fixtures";

const stubSearch = (page: any, results: unknown[]) => page.route("**/nominatim.openstreetmap.org/**", (r: any) => r.fulfill({ json: results }));
const area = (page: any) => page.getByRole("combobox", { name: "Area" });
const saved = async (page: any, plotNo: string) => (await (await page.request.get(`${API}/plots`)).json()).find((p: any) => p.plot_no === plotNo);

test.describe("Plot form", () => {
  test("a second plot with the same area, sector and number is refused with a clear message", async ({ page, plot }) => {
    await plot({ area: "Dupe Area", plot_no: "DUPE-1", sector: "S1" });
    await page.goto("/dashboard/plots/new");
    await area(page).fill("Dupe Area");
    await area(page).press("Escape");
    await page.locator('input[name="sector"]').fill("S1");
    await page.locator('input[name="plot_no"]').fill("DUPE-1");
    await page.getByRole("button", { name: "Add plot" }).click();
    await expect(page.getByText("A plot with this area, sector and number already exists")).toBeVisible();
    await expect(page).toHaveURL(/plots\/new$/);
  });

  test("the size must be a positive number", async ({ page }) => {
    await page.goto("/dashboard/plots/new");
    await area(page).fill("Size Area");
    await area(page).press("Escape");
    await page.locator('input[name="plot_no"]').fill("SIZE-1");
    await page.locator('input[name="size"]').fill("-5");
    await page.getByRole("button", { name: "Add plot" }).click();
    await expect(page.getByText("Size must be a positive number")).toBeVisible();
  });

  test("all the details are saved: street, sector, size, corner and the plot number with spaces", async ({ page }) => {
    await page.goto("/dashboard/plots/new");
    await area(page).fill("Detail Area");
    await area(page).press("Escape");
    await page.locator('input[name="sector"]').fill("Al Murtaza Commercial");
    await page.locator('input[name="street"]').fill("Al Murtaza Lane 3");
    await page.locator('input[name="plot_no"]').fill("167 & 169");
    await page.locator('input[name="size"]').fill("400");
    await page.getByRole("combobox", { name: "Corner" }).click();
    await page.getByRole("option", { name: "Yes" }).click();
    await page.getByRole("button", { name: "Add plot" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots$/);
    const p = await saved(page, "167 & 169");
    expect([p.area, p.sector, p.street, p.size_sqyd, p.corner]).toEqual(["Detail Area", "Al Murtaza Commercial", "Al Murtaza Lane 3", 400, true]);
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(page.getByRole("heading", { name: "Detail Area Al Murtaza Commercial #167 & 169" })).toBeVisible();
    await expect(page.getByText("Al Murtaza Lane 3 · 400 sq yd · Corner")).toBeVisible();
  });

  test("editing shows what is saved and changes only what you change", async ({ page, plot }) => {
    const p = await plot({ area: "Edit Area", plot_no: "EDIT-1", street: "Old Street", size_sqyd: 300 });
    await page.goto(`/dashboard/plots/${p.id}/edit`);
    await expect(area(page)).toHaveValue("Edit Area");
    await expect(page.locator('input[name="street"]')).toHaveValue("Old Street");
    await expect(page.locator('input[name="size"]')).toHaveValue("300");
    await page.locator('input[name="street"]').fill("New Street");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots$/);
    const after = await saved(page, "EDIT-1");
    expect([after.street, after.size_sqyd, after.area]).toEqual(["New Street", 300, "Edit Area"]);
  });

  test("Cancel leaves the plot untouched", async ({ page, plot }) => {
    const p = await plot({ plot_no: "CANCEL-1", street: "Same Street" });
    await page.goto(`/dashboard/plots/${p.id}/edit`);
    await page.locator('input[name="street"]').fill("Changed but cancelled");
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/plots/${p.id}$`));
    expect((await saved(page, "CANCEL-1")).street).toBe("Same Street");
  });
});

test.describe("Choosing a location", () => {
  test("searching a place offers results; choosing one puts the pin there and saves its coordinates", async ({ page }) => {
    await stubSearch(page, [{ place_id: 1, display_name: "Al Murtaza Commercial, DHA Phase 6, Karachi", lat: "24.7942", lon: "67.0689" }]);
    await page.goto("/dashboard/plots/new");
    await area(page).fill("Search Area");
    await area(page).press("Escape");
    await page.locator('input[name="plot_no"]').fill("SEARCH-1");
    await page.getByLabel("Search for a place").fill("Al Murtaza Lane 3");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: /Al Murtaza Commercial, DHA Phase 6/ }).click();
    await expect(page.getByText(/Pin at 24\.79420, 67\.06890/)).toBeVisible();
    await page.getByRole("button", { name: "Add plot" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots$/);
    const p = await saved(page, "SEARCH-1");
    expect([p.gps_lat, p.gps_lon]).toEqual([24.7942, 67.0689]);
  });

  test("a search with no results says so and suggests clicking the map", async ({ page }) => {
    await stubSearch(page, []);
    await page.goto("/dashboard/plots/new");
    await page.getByLabel("Search for a place").fill("zzzz nowhere");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText(/Nothing found/)).toBeVisible();
  });

  test("pasting a Google Maps link places the pin without searching", async ({ page }) => {
    await page.goto("/dashboard/plots/new");
    await page.getByLabel("Search for a place").fill("https://www.google.com/maps/place/X/@24.8100,67.0600,17z/data=!3d24.8100!4d67.0600");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText(/Pin at 24\.81000, 67\.06000/)).toBeVisible();
  });

  test("a short map link that cannot be read asks for the long address", async ({ page }) => {
    await page.goto("/dashboard/plots/new");
    await page.getByLabel("Search for a place").fill("https://maps.app.goo.gl/abc123");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText(/That link can't be read/)).toBeVisible();
  });

  test("typing coordinates by hand moves the pin; bad ones are refused", async ({ page }) => {
    await page.goto("/dashboard/plots/new");
    await area(page).fill("Coord Area");
    await area(page).press("Escape");
    await page.locator('input[name="plot_no"]').fill("COORD-1");
    await page.getByRole("button", { name: "Type the coordinates instead" }).click();
    await page.getByPlaceholder("24.8000, 67.0500").fill("not coordinates");
    await page.getByRole("button", { name: "Add plot" }).click();
    await expect(page.getByText("Paste coordinates like 24.8000, 67.0500")).toBeVisible();
    await page.getByPlaceholder("24.8000, 67.0500").fill("24.8, 67.05");
    await expect(page.getByText(/Pin at 24\.80000, 67\.05000/)).toBeVisible();
    await page.getByRole("button", { name: "Add plot" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots$/);
    const p = await saved(page, "COORD-1");
    expect([p.gps_lat, p.gps_lon]).toEqual([24.8, 67.05]);
  });

  test("Use where I am now places the pin from the browser's location", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 24.8607, longitude: 67.0011 });
    await page.goto("/dashboard/plots/new");
    await page.getByRole("button", { name: "Use where I am now" }).click();
    await expect(page.getByText(/Pin at 24\.86070, 67\.00110/)).toBeVisible();
  });

  test("dragging the pin updates the coordinates", async ({ page }) => {
    await page.goto("/dashboard/plots/new");
    const map = page.locator(".maplibregl-canvas");
    await map.click({ position: { x: 300, y: 150 } });
    const before = await page.getByText(/Pin at/).innerText();
    const pin = page.locator(".maplibregl-marker");
    const box = (await pin.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height + 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => page.getByText(/Pin at/).innerText()).not.toBe(before);
  });
});
