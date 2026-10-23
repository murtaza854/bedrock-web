import { API, expect, test } from "./fixtures";

const anchor = async (request: any, data: Record<string, unknown>) => {
  const r = await request.post(`${API}/anchors`, { data: { kind: "market", notes: "", lat: 25.0, lon: 67.3, ...data } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
};
const anchorRow = (page: any, name: string) => page.locator("tbody tr", { hasText: name });
const ready = async (page: any) => { await page.goto("/dashboard/map"); await page.locator(".maplibregl-canvas").waitFor(); };

test.describe("Anchors", () => {
  test("add an anchor by clicking the map; it needs a name and appears in the list", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Add an anchor" }).click();
    await expect(page.getByText("Click the map where the place is.")).toBeVisible();
    await page.locator(".maplibregl-canvas").click({ position: { x: 300, y: 200 } });
    await expect(page.getByText(/^\d+\.\d+, \d+\.\d+$/)).toBeVisible(); // the clicked spot

    await page.getByRole("button", { name: "Save anchor" }).click();
    await expect(page.getByText("Name the place")).toBeVisible();
    await page.getByPlaceholder("Name of the place").fill("Click Market");
    await page.getByPlaceholder("Notes (optional)").fill("Open late");
    await page.getByRole("button", { name: "Save anchor" }).click();

    const row = anchorRow(page, "Click Market");
    await expect(row).toContainText("Market");
    await expect(row).toContainText("Open late");
    await expect(row).toContainText("today");
  });

  test("cancelling an anchor in progress saves nothing", async ({ page, request }) => {
    const before = (await (await request.get(`${API}/anchors`)).json()).length;
    await ready(page);
    await page.getByRole("button", { name: "Add an anchor" }).click();
    await page.locator(".maplibregl-canvas").click({ position: { x: 250, y: 180 } });
    await page.getByPlaceholder("Name of the place").fill("Never saved");
    await page.getByRole("button", { name: "Cancel" }).first().click();
    await expect(page.getByPlaceholder("Name of the place")).toHaveCount(0);
    expect((await (await request.get(`${API}/anchors`)).json()).length).toBe(before);
  });

  test("an anchor can be reconfirmed, and deleting asks first", async ({ page, request }) => {
    await anchor(request, { name: "Shaky School", kind: "school" });
    await page.goto("/dashboard/map");
    const row = anchorRow(page, "Shaky School");
    await row.getByRole("button", { name: "Still there" }).click();
    await expect(row).toContainText("today");

    await row.getByRole("button", { name: "Delete" }).click();
    await row.getByRole("button", { name: "Keep" }).click();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Delete" }).click();
    await row.getByRole("button", { name: "Delete" }).click(); // the confirm
    await expect(anchorRow(page, "Shaky School")).toHaveCount(0);
  });

  test("an anchor with an impossible location is refused by the API", async ({ request }) => {
    const r = await request.post(`${API}/anchors`, { data: { name: "Nowhere", kind: "market", lat: 95, lon: 67 } });
    expect(r.status()).toBe(400);
    const bad = await request.post(`${API}/anchors`, { data: { name: "Odd", kind: "volcano", lat: 25, lon: 67 } });
    expect(bad.status()).toBe(400);
  });
});

test.describe("Plot markers", () => {
  test("clicking a plot marker shows its details and the nearest anchor with a straight-line distance", async ({ page, plot, request }) => {
    await anchor(request, { name: "Nearby Hospital", kind: "hospital", lat: 25.001, lon: 67.3 }); // about 111 m north
    const p = await plot({ plot_no: "MAP-NEAR", size_sqyd: 400, gps_lat: 25.0, gps_lon: 67.3 });
    await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker: "Map Broker", quote_type: "asking", price_pkr: 80_000_000, inclusions: "" } });
    await ready(page);
    await page.getByRole("button", { name: /MAP-NEAR/ }).dispatchEvent("click");
    const card = page.locator("div.w-72", { has: page.getByRole("link", { name: "Open plot →" }) });
    await expect(card).toContainText("MAP-NEAR");
    await expect(card).toContainText("400 sq yd");
    await expect(card).toContainText("PKR 80,000,000");
    await expect(card).toContainText("Hospital: Nearby Hospital");
    await expect(card).toContainText(/1\d\d m/); // 111 m, straight line
    await expect(card.getByRole("link", { name: "Open plot →" })).toHaveAttribute("href", `/dashboard/plots/${p.id}`);
  });

  test("a marker is coloured by the plot's status", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "MAP-COLOUR", gps_lat: 25.02, gps_lon: 67.32 });
    await request.patch(`${API}/plots/${p.id}`, { data: { status: "shortlisted" } });
    await ready(page);
    const marker = page.getByRole("button", { name: /MAP-COLOUR/ });
    await expect(marker).toHaveCSS("background-color", "rgb(56, 189, 248)");
  });

  test("the colour layer switches the legend", async ({ page }) => {
    await ready(page);
    await expect(page.locator("ul", { hasText: "Shortlisted" })).toContainText("Negotiating");
    await page.getByRole("combobox", { name: "Colour by" }).click();
    await page.getByRole("option", { name: "Colour by score" }).click();
    await expect(page.getByText("Not scored")).toBeVisible();
    await page.getByRole("combobox", { name: "Colour by" }).click();
    await page.getByRole("option", { name: "Colour by price per sq yd" }).click();
    await expect(page.getByText("10%+ below the median")).toBeVisible();
  });

  test("a plot without a location is listed as not on the map yet", async ({ page, plot }) => {
    const p = await plot({ plot_no: "MAP-UNPLACED" });
    await page.goto("/dashboard/map");
    const list = page.locator("section", { has: page.getByRole("heading", { name: /^Not on the map yet/ }) });
    const row = list.locator("li", { hasText: "MAP-UNPLACED" });
    await expect(row).toBeVisible();
    await expect(row.getByRole("link", { name: "Add coordinates →" })).toHaveAttribute("href", `/dashboard/plots/${p.id}/edit`);
  });
});
