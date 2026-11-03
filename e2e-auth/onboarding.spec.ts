import { API, expect, test } from "./fixtures";
import { totp } from "./totp";

// The setup wizard after the password: a passkey or the authenticator app (at least one), then Finish. Nothing else opens before.
test.describe("Setup wizard", () => {
  test("the authenticator app needs two codes in a row; Finish stays off until it is on; then the dashboard opens", async ({ owner, browser }) => {
    const email = `wiz${Date.now()}@e2e.test`;
    const { link } = await (await owner.post(`${API}/admin/users`, { data: { email, name: "", role: "viewer" } })).json();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(link);
    await page.getByPlaceholder("Password", { exact: true }).fill("Granite-lantern-3092");
    await page.getByPlaceholder("Repeat password").fill("Granite-lantern-3092");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("button", { name: "Finish" })).toBeDisabled();
    await page.goto("/dashboard/plots");
    await expect(page).toHaveURL(/\/onboarding$/); // nothing else opens

    await page.getByRole("button", { name: "Set up two-factor" }).click();
    const secret = ((await page.locator("span.font-mono").first().innerText()) || "").replace(/\s/g, "");
    await page.getByPlaceholder("First code").fill(totp(secret, -1));
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByText("Wait for the code to change")).toBeVisible(); // the second code is required
    await page.getByPlaceholder("Next code").fill(totp(secret, 1)); // not the one right after the first
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByText(/second code must be the one your app shows right after the first/)).toBeVisible();
    await page.getByPlaceholder("Next code").fill(totp(secret)); // the one right after
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByText("Save these backup codes now.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish" })).toBeDisabled(); // not before the codes are saved
    await page.getByRole("button", { name: "I have saved them" }).click();
    await expect(page.getByRole("button", { name: "Finish" })).toBeEnabled();
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
    expect((await context.request.get(`${API}/plots`)).status()).toBe(200); // open from here on
    await page.getByRole("button", { name: "Open Bedrock" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await context.close();
  });

  test("Finish is refused by the server too when neither way is set up", async ({ owner, browser }) => {
    const email = `wiz2${Date.now()}@e2e.test`;
    const { link } = await (await owner.post(`${API}/admin/users`, { data: { email, name: "", role: "viewer" } })).json();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(link);
    await page.getByPlaceholder("Password", { exact: true }).fill("Granite-lantern-3092");
    await page.getByPlaceholder("Repeat password").fill("Granite-lantern-3092");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    const r = await context.request.post(`${API}/account/onboarding/finish`, { data: {} });
    expect(r.status()).toBe(400);
    expect(await r.text()).toContain("passkey or an authenticator app");
    await context.close();
  });

  test("an invited person's copy-link button gives a new link and the old one stops working", async ({ as, owner }) => {
    const email = `copy${Date.now()}@e2e.test`;
    const first = await (await owner.post(`${API}/admin/users`, { data: { email, name: "Copy Person", role: "viewer" } })).json();
    const admin = await as((await import("./fixtures")).PEOPLE.owner);
    await admin.context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await admin.page.goto("/dashboard/admin");
    const row = admin.page.getByRole("row", { name: new RegExp(email) });
    await row.getByRole("button", { name: "Copy link" }).click();
    await expect(admin.page.getByRole("status")).toContainText("copied");
    const copied = await admin.page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("/welcome?token=");
    expect(copied).not.toBe(first.link);
    const oldToken = new URL(first.link).searchParams.get("token");
    expect((await owner.post(`${API}/invite/lookup`, { data: { token: oldToken } })).status()).toBe(400); // replaced
    expect((await owner.post(`${API}/invite/lookup`, { data: { token: new URL(copied).searchParams.get("token") } })).status()).toBe(200);
  });
});
