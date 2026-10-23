import { API, MAP_PNG, expect, test } from "./fixtures";

const HANDLES = '.maplibregl-marker[title="Top left"], .maplibregl-marker[title="Top right"], .maplibregl-marker[title="Bottom right"], .maplibregl-marker[title="Bottom left"], .maplibregl-marker[title^="Drag to move"]';

test("upload a society map, place it, change its opacity, delete it", async ({ page, request }) => {
  await page.goto("/dashboard/map");
  await page.locator(".maplibregl-canvas").waitFor();
  await page.getByPlaceholder("Name, e.g. DHA Phase 6").fill("Test grid");
  await page.locator('input[type="file"]').setInputFiles({ name: "grid.png", mimeType: "image/png", buffer: MAP_PNG });
  await page.getByRole("button", { name: "Upload map" }).click();

  // a new map goes straight into placement: four corners and a move dot
  await expect(page.locator(HANDLES)).toHaveCount(5);
  await page.getByRole("button", { name: "Save placement" }).click();
  await expect(page.getByText("Placement saved.")).toBeVisible();
  await expect(page.locator(HANDLES)).toHaveCount(0);

  let list = await (await request.get(`${API}/overlays`)).json();
  expect(list).toHaveLength(1);
  expect(list[0].corners).toHaveLength(4);
  expect([list[0].width, list[0].height]).toEqual([16, 12]);

  await page.getByRole("slider", { name: /Opacity of Test grid/ }).fill("0.35");
  await expect.poll(async () => (await (await request.get(`${API}/overlays`)).json())[0].opacity).toBe(0.35);

  const img = await request.get(`${API}/overlays/${list[0].id}/image`); // stored encrypted, served decrypted
  expect(img.headers()["content-type"]).toBe("image/png");
  expect((await img.body()).equals(MAP_PNG)).toBeTruthy();

  page.once("dialog", (d) => d.accept());
  await page.locator("section", { has: page.getByRole("heading", { name: /^Society maps/ }) }).getByRole("button", { name: "Delete" }).click();
  await expect.poll(async () => (await (await request.get(`${API}/overlays`)).json()).length).toBe(0);
});

test("a file that is not an image is refused with a clear message", async ({ page }) => {
  await page.goto("/dashboard/map");
  await page.locator(".maplibregl-canvas").waitFor();
  await page.getByPlaceholder("Name, e.g. DHA Phase 6").fill("Bad");
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await page.getByRole("button", { name: "Upload map" }).click();
  await expect(page.getByText("that file is not a PNG or JPEG image")).toBeVisible();
});
