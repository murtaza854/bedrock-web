import { APIRequestContext, Browser, BrowserContext, Page, expect, test as base } from "@playwright/test";

export const API = "http://localhost:8102";
export const PEOPLE = {
  owner: { email: "owner@e2e.test", password: "Owner-pass-12345" },
  editor: { email: "editor@e2e.test", password: "Editor-pass-12345" },
  viewer: { email: "viewer@e2e.test", password: "Viewer-pass-12345" },
};
export const ALL_TILES = "**/tile.openstreetmap.org/**";
const BLANK_TILE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

// log in through the API: the session cookie is kept by this request context
export async function login(request: APIRequestContext, email: string, password: string) {
  const r = await request.post(`${API}/login`, { data: { email, password } });
  expect(r.status(), `login as ${email}: ${await r.text()}`).toBe(204);
  return request;
}

export type Session = { page: Page; context: BrowserContext; request: APIRequestContext };

export const test = base.extend<{
  as: (who: { email: string; password: string }) => Promise<Session>;
  owner: APIRequestContext;
  newPerson: (role?: string) => Promise<{ email: string; password: string }>;
}>({
  // a browser (and API client) already signed in as the given person
  as: async ({ browser, playwright }, use) => {
    const opened: BrowserContext[] = [], clients: APIRequestContext[] = [];
    await use(async (who) => {
      const request = await playwright.request.newContext();
      clients.push(request);
      await login(request, who.email, who.password);
      const context = await browser.newContext({ storageState: await request.storageState() });
      opened.push(context);
      await context.route(ALL_TILES, (r) => r.fulfill({ contentType: "image/png", body: BLANK_TILE }));
      return { page: await context.newPage(), context, request };
    });
    for (const c of opened) await c.close();
    for (const c of clients) await c.dispose();
  },
  // the owner's API client, for setting things up
  owner: async ({ playwright }, use) => {
    const request = await playwright.request.newContext();
    await login(request, PEOPLE.owner.email, PEOPLE.owner.password);
    await use(request);
    await request.dispose();
  },
  // a brand-new person, so a test that changes a password or two-factor never disturbs the shared ones
  newPerson: async ({ owner }, use) => {
    let n = 0;
    await use(async (role = "editor") => {
      const who = { email: `t${Date.now()}-${n++}@e2e.test`, password: "Fresh-pass-12345" };
      const r = await owner.post(`${API}/admin/users`, { data: { ...who, name: "", role } });
      expect(r.ok(), await r.text()).toBeTruthy();
      return who;
    });
  },
});
export { expect };
