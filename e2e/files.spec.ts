import { API, MAP_PNG, expect, test } from "./fixtures";

import { deflateSync, crc32 } from "node:zlib";

const upload = (request: any, plotId: number, file: { name: string; mimeType: string; buffer: Buffer }, label = "", extra: Record<string, string> = {}) =>
  request.post(`${API}/plots/${plotId}/files`, { multipart: { file, label, ...extra } });

// a PNG of the given size with a diagonal pattern: big in pixels, a few MB as a file
function bigPng(w: number, h: number) {
  const rows = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; rows[o] = (x * 3 + y * 2) & 255; rows[o + 1] = (x * 5) & 255; rows[o + 2] = (y * 7 + x) & 255; }
  const chunk = (type: string, data: Buffer) => { const body = Buffer.concat([Buffer.from(type), data]); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows, { level: 1 })), chunk("IEND", Buffer.alloc(0))]);
}
const widthOf = (png: Buffer) => png.readUInt32BE(16);

test.describe("Plot files", () => {
  test("a file is added on the plot page, opened as the same bytes, and deleted after asking", async ({ page, plot, request }) => {
    const p = await plot({ area: "Files Town" });
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(page.getByText("No files yet")).toBeVisible();
    await page.getByRole("button", { name: "+ Add file" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: MAP_PNG });
    await page.getByLabel("File label").fill("Lease deed");
    await page.getByRole("button", { name: "Upload" }).click();
    const item = page.locator("li", { hasText: "Lease deed" });
    await expect(item).toContainText("scan.png");

    const list = await (await request.get(`${API}/plots/${p.id}/files`)).json();
    const opened = await request.get(`${API}/files/${list[0].id}`); // sealed on disk, served as it was uploaded
    expect(opened.status()).toBe(200);
    expect(opened.headers()["content-type"]).toBe("image/png");
    expect(Buffer.compare(await opened.body(), MAP_PNG)).toBe(0);

    await item.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(item).toHaveCount(1);
    await item.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete file" }).click();
    await expect(item).toHaveCount(0);
    expect((await request.get(`${API}/files/${list[0].id}`)).status()).toBe(404);
  });

  test("only images and PDFs are taken, judged by what they are, up to 15 MB", async ({ plot, request }) => {
    const p = await plot({});
    const pdf = await upload(request, p.id, { name: "page.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n") });
    expect(pdf.ok(), await pdf.text()).toBeTruthy();
    expect((await pdf.json()).label).toBe("page"); // no label given: the file name without its ending
    const html = await upload(request, p.id, { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") }); // wrong inside, whatever the name says
    expect(html.status()).toBe(400);
    expect((await upload(request, p.id, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("notes") })).status()).toBe(400);
    const big = await upload(request, p.id, { name: "big.png", mimeType: "image/png", buffer: Buffer.concat([MAP_PNG, Buffer.alloc(15 * 1024 * 1024)]) });
    expect(big.status()).toBe(413);
    expect((await upload(request, 999999, { name: "a.png", mimeType: "image/png", buffer: MAP_PNG })).status()).toBe(404);
  });

  test("a fact can point at a file, shows the link, and keeps its text if the file is deleted", async ({ page, plot, request }) => {
    const p = await plot({ area: "Files Town" });
    const f = await (await upload(request, p.id, { name: "lease.png", mimeType: "image/png", buffer: MAP_PNG }, "Lease deed")).json();
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.getByRole("button", { name: "+ Add claim" }).click();
    await expect(page.locator("#fact-names option")).toHaveCount(12); // the scorecard's fact names are offered
    await page.getByPlaceholder("Field (e.g. corner, road_width_ft)").fill("road_width_ft");
    await page.getByPlaceholder("Value").fill("35");
    await page.getByPlaceholder("Source").fill("Lease deed sketch plan");
    await page.getByRole("combobox", { name: "Source file" }).click();
    await page.getByRole("option", { name: "Lease deed" }).click();
    await page.getByRole("button", { name: "Save claim" }).click();
    const fact = page.locator("li", { hasText: "Road width ft" });
    await expect(fact.getByRole("link", { name: "Lease deed" })).toHaveAttribute("href", `${API}/files/${f.id}`);

    const claims = (await (await request.get(`${API}/plots/${p.id}`)).json()).claims;
    expect(claims[0].file_id).toBe(f.id);
    const other = await plot({});
    const wrong = await request.post(`${API}/plots/${other.id}/claims`, { data: { field: "corner", value: "yes", source: "x", verification: "claimed", file_id: f.id } }); // another plot's file
    expect(wrong.status()).toBe(400);

    await request.delete(`${API}/files/${f.id}`);
    await page.reload();
    await expect(fact).toContainText("35");
    await expect(fact.getByRole("link", { name: "Lease deed" })).toHaveCount(0);
  });

  test("a big image is shrunk when uploaded and the saving is shown; keeping the original leaves it exactly as it was", async ({ page, plot, request }) => {
    const p = await plot({ area: "Files Town" });
    const big = bigPng(3200, 2400);
    expect(big.length).toBeLessThan(15 * 1024 * 1024);
    const shrunk = await (await upload(request, p.id, { name: "scan.png", mimeType: "image/png", buffer: big }, "Big scan")).json();
    expect(shrunk.original_size).toBe(big.length); // remembered, so it can be shown
    expect(shrunk.size).toBeLessThan(big.length);
    const served = await (await request.get(`${API}/files/${shrunk.id}`)).body();
    expect(served.length).toBe(shrunk.size);
    expect(widthOf(served)).toBe(3000); // the longest side is cut to 3000 pixels

    const kept = await (await upload(request, p.id, { name: "scan.png", mimeType: "image/png", buffer: big }, "Kept", { keep_original: "1" })).json();
    expect(kept.original_size).toBe(0);
    expect(Buffer.compare(await (await request.get(`${API}/files/${kept.id}`)).body(), big)).toBe(0);

    const tiny = await (await upload(request, p.id, { name: "tiny.png", mimeType: "image/png", buffer: MAP_PNG }, "Tiny")).json();
    expect(tiny.original_size).toBe(0); // small files are left alone

    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(page.locator("li", { hasText: "Big scan" })).toContainText("shrunk from");
    await expect(page.locator("li", { hasText: "Kept" })).not.toContainText("shrunk from");
    await page.getByRole("button", { name: "+ Add file" }).click();
    await expect(page.getByLabel("Keep the original")).toBeVisible();
  });
});
