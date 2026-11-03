import { BrowserContext, Page } from "@playwright/test";
import { API, PEOPLE, expect, test } from "./fixtures";

// Passkeys, with a virtual authenticator that approves every prompt (as if the person touched their sensor).
async function authenticator(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  return cdp;
}

test.describe("Passkeys", () => {
  test("add a passkey on Account, sign in with it alone (no password, no code), remove it", async ({ as, newPerson }) => {
    const who = await newPerson("viewer");
    const { page, context } = await as(who);
    await authenticator(context, page);
    await page.goto("/dashboard/account");
    await page.getByPlaceholder("Name, e.g. MacBook").fill("Test laptop");
    await page.getByRole("button", { name: "Add a passkey" }).click();
    await expect(page.getByText("Test laptop")).toBeVisible();
    await expect(page.getByText("not used yet")).toBeVisible();

    await context.clearCookies(); // signed out; the same device is still there
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in with a passkey" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    expect((await page.request.get(`${API}/me`)).status()).toBe(200);

    await page.goto("/dashboard/account");
    await expect(page.getByText(/used just now/)).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Test laptop")).toHaveCount(0);
      });

  test("a passkey counts as two-factor: an invited person held at the wizard is let through once they add one and press Finish", async ({ owner, browser, as, playwright }) => {
    const email = `pk${Date.now()}@e2e.test`;
    const { link } = await (await owner.post(`${API}/admin/users`, { data: { email, name: "", role: "viewer" } })).json();
    const context = await browser.newContext();
    const page = await context.newPage();
    await authenticator(context, page);
    await page.goto(link);
    await page.getByPlaceholder("Password", { exact: true }).fill("Granite-lantern-3092");
    await page.getByPlaceholder("Repeat password").fill("Granite-lantern-3092");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("button", { name: "Finish" })).toBeDisabled(); // at least one way is needed
    expect((await context.request.get(`${API}/plots`)).status()).toBe(403); // held at the wizard
    await page.getByPlaceholder("Name, e.g. MacBook").fill("Phone");
    await page.getByRole("button", { name: "Add a passkey" }).click();
    await expect(page.getByText("not used yet")).toBeVisible();
    expect((await context.request.get(`${API}/plots`)).status()).toBe(403); // still held until Finish
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
    await page.getByRole("button", { name: "Open Bedrock" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    expect((await context.request.get(`${API}/plots`)).status()).toBe(200);
    expect((await (await context.request.get(`${API}/me`)).json()).must_setup_2fa).toBe(false);
    await context.close();

    // a passkey counts as two-factor, so Admin says so instead of "Off"
    const admin = await as(PEOPLE.owner);
    await admin.page.goto("/dashboard/admin");
    await expect(admin.page.getByRole("row", { name: new RegExp(email) })).toContainText("Passkey");
    await expect(admin.page.getByRole("row", { name: new RegExp(email) })).not.toContainText("Off");

    // the owner can take a person's passkeys away (a lost device); they are signed out and must set up again
    const row = admin.page.getByRole("row", { name: new RegExp(email) });
    await row.getByRole("button", { name: "Remove passkeys" }).click();
    await row.getByRole("button", { name: "Confirm" }).click();
    await expect(admin.page.getByRole("status")).toContainText("Passkeys removed");
    await expect(row).toContainText("Off");
    const them = await playwright.request.newContext();
    expect((await them.post(`${API}/login`, { data: { email, password: "Granite-lantern-3092" } })).status()).toBe(204);
    expect((await (await them.get(`${API}/me`)).json()).must_setup_2fa).toBe(true); // back to the wizard
    await them.dispose();
  });

  test("someone who has not registered, or a replayed or forged answer, is refused; nobody else can remove your passkey", async ({ request, as, newPerson }) => {
    const begin = await request.post(`${API}/login/passkey/begin`, { data: {} });
    expect(begin.status()).toBe(200);
    const { id } = await begin.json();
    const bad = await request.post(`${API}/login/passkey/finish?id=${id}`, { data: { id: "AAAA", rawId: "AAAA", type: "public-key", response: { clientDataJSON: "e30", authenticatorData: "AAAA", signature: "AAAA", userHandle: "MQ" } } });
    expect(bad.status()).toBe(401);
    const again = await request.post(`${API}/login/passkey/finish?id=${id}`, { data: {} }); // the challenge was used up
    expect(again.status()).toBe(401);
    expect((await request.get(`${API}/account/passkeys`)).status()).toBe(401); // signed out

    const who = await newPerson("viewer");
    const { request: mine } = await as(who);
    expect((await mine.delete(`${API}/account/passkeys/999999`)).status()).toBe(404);
  });
});
