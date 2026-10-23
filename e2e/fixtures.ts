import { expect, test as base } from "@playwright/test";

export const API = "http://localhost:8101";

// 1x1 transparent PNG, standing in for map tiles so tests do not depend on the internet
const BLANK_TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
// a small valid PNG (16x12) to upload as a "scanned map"
export const MAP_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAMCAIAAADkharWAAAAJklEQVR42mM4YWPz/+sJCCKGzUCSaiCbgSTVUBtIchXDqB8GhR8AdIPF0A+nWbAAAAAASUVORK5CYII=", "base64");

export const test = base.extend<{ plot: (p: Record<string, unknown>) => Promise<any> }>({
  page: async ({ page }, use) => {
    await page.route("**/tile.openstreetmap.org/**", (r) => r.fulfill({ contentType: "image/png", body: BLANK_TILE }));
    await page.route("**/nominatim.openstreetmap.org/**", (r) => r.fulfill({ json: [] }));
    await use(page);
  },
  // creates a plot straight through the API, so a test starts from the state it needs
  plot: async ({ request }, use) => {
    let n = 0;
    await use(async (p) => {
      const r = await request.post(`${API}/plots`, { data: { area: "DHA Phase 6", plot_no: `T${Date.now()}-${n++}`, size_sqyd: 400, ...p } });
      expect(r.ok(), await r.text()).toBeTruthy();
      return r.json();
    });
  },
});
export { expect };
