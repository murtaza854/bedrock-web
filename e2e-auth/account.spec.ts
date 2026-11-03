import { Page } from "@playwright/test";
import { API, expect, login, test } from "./fixtures";
import { totp } from "./totp";

// turns on two-factor from the Account page and returns the secret and the backup codes shown
async function turnOn2fa(page: Page) {
  await page.goto("/dashboard/account");
  await page.getByRole("button", { name: "Set up two-factor" }).click();
  await expect(page.getByAltText("QR code to scan with your authenticator app")).toBeVisible();
  const secret = ((await page.locator("span.font-mono").first().innerText()) || "").replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  await page.getByPlaceholder("123456").fill("000000");
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText(/that code is not right/)).toBeVisible();
  await page.getByPlaceholder("123456").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText("Save these backup codes now.")).toBeVisible();
  const codes = await page.locator("ul.font-mono li").allInnerTexts();
  await page.getByRole("button", { name: "I have saved them" }).click();
  return { secret, codes };
}

// a plain browser, not signed in, goes through the login form
async function logIn(browser: any, who: { email: string; password: string }) {
  const context = await browser.newContext();
  const page: Page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(who.email);
  await page.getByPlaceholder("Password").fill(who.password);
  await page.getByRole("button", { name: "Log in" }).click();
  return { context, page };
}

test.describe("Password", () => {
  test("the form checks each field and the current password", async ({ as, newPerson }) => {
    const { page } = await as(await newPerson());
    await page.goto("/dashboard/account");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Enter your current password")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();
    await page.locator('input[name="current"]').fill("Fresh-pass-12345");
    await page.locator('input[name="next"]').fill("Brand-new-pass-1");
    await page.locator('input[name="again"]').fill("Something-else-12");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("The two passwords don't match")).toBeVisible();

    await page.locator('input[name="current"]').fill("Not-my-password-1");
    await page.locator('input[name="again"]').fill("Brand-new-pass-1");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("your current password is not right")).toBeVisible();
  });

  test("changing it works for the next login, and signs out every other device", async ({ as, newPerson, browser }) => {
    const who = await newPerson();
    const here = await as(who);
    const other = await as(who); // a second device
    expect((await other.request.get(`${API}/plots`)).status()).toBe(200);

    await here.page.goto("/dashboard/account");
    await here.page.locator('input[name="current"]').fill(who.password);
    await here.page.locator('input[name="next"]').fill("Brand-new-pass-1");
    await here.page.locator('input[name="again"]').fill("Brand-new-pass-1");
    await here.page.getByRole("button", { name: "Change password" }).click();
    await expect(here.page.getByText("Changed. Your other devices were signed out.")).toBeVisible();

    expect((await other.request.get(`${API}/plots`)).status()).toBe(401); // the other device is out
    expect((await here.request.get(`${API}/plots`)).status()).toBe(200); // this one stays in
    const old = await here.request.post(`${API}/login`, { data: { email: who.email, password: who.password } });
    expect(old.status()).toBe(401);
    const { page } = await logIn(browser, { email: who.email, password: "Brand-new-pass-1" });
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the new password cannot be the old one or the email address", async ({ as, newPerson }) => {
    const who = await newPerson();
    const { request } = await as(who);
    const same = await request.post(`${API}/account/password`, { data: { current: who.password, new: who.password } });
    expect(same.status()).toBe(400);
    const email = await request.post(`${API}/account/password`, { data: { current: who.password, new: who.email } });
    expect(email.status()).toBe(400);
    expect(await email.text()).toContain("must not contain the email");
  });
});

test.describe("Where you are signed in", () => {
  test("lists every device, marks this one, and can sign the others out", async ({ as, newPerson }) => {
    const who = await newPerson();
    const here = await as(who);
    const second = await as(who), third = await as(who);
    await here.page.goto("/dashboard/account");
    const list = here.page.locator("section", { has: here.page.getByRole("heading", { name: /Where you're signed in/ }) });
    await expect(list.locator("li")).toHaveCount(3);
    await expect(list.getByText("This device")).toHaveCount(1);

    await list.locator("li", { hasNotText: "This device" }).first().getByRole("button", { name: "Sign out" }).click();
    await expect(list.locator("li")).toHaveCount(2);
    const statuses = await Promise.all([second, third].map(async (s) => (await s.request.get(`${API}/plots`)).status()));
    expect(statuses.sort()).toEqual([200, 401]); // exactly one of the other two was signed out

    await here.page.getByRole("button", { name: "Sign out every other device" }).click();
    await expect(list.locator("li")).toHaveCount(1);
    expect((await second.request.get(`${API}/plots`)).status()).toBe(401);
    expect((await third.request.get(`${API}/plots`)).status()).toBe(401);
    expect((await here.request.get(`${API}/plots`)).status()).toBe(200);
  });
});

test.describe("Two-factor sign-in", () => {
  test("turning it on needs a real code, shows ten backup codes once, and is then marked On", async ({ as, newPerson, owner }) => {
    const who = await newPerson();
    const { page } = await as(who);
    const { codes } = await turnOn2fa(page);
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    await expect(page.getByText("On", { exact: true })).toBeVisible();
    const users = await (await owner.get(`${API}/admin/users`)).json();
    expect(users.find((u: any) => u.email === who.email).totp_enabled).toBe(true);
  });

  test("after that, logging in asks for a code; a code works once and a wrong one does not", async ({ as, newPerson, browser }) => {
    const who = await newPerson();
    const { secret } = await turnOn2fa((await as(who)).page);

    const { page, context } = await logIn(browser, who);
    await expect(page.getByRole("heading", { name: "Check your app" })).toBeVisible();
    await page.getByPlaceholder("123456").fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.locator("p[role=alert]")).toBeVisible(); // the code is refused and we stay on the login page
    await expect(page).toHaveURL(/\/login$/);

    const next = totp(secret, 1); // the next 30-second code: newer than the one used to turn it on, within what the server allows
    await page.getByPlaceholder("123456").fill(next);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await context.close();

    const replay = await logIn(browser, who); // the same code again is a replay
    await replay.page.getByPlaceholder("123456").fill(next);
    await replay.page.getByRole("button", { name: "Verify" }).click();
    await expect(replay.page).toHaveURL(/\/login$/);
  });

  test("a backup code gets you in once, and only once", async ({ as, newPerson, browser }) => {
    const who = await newPerson();
    const { codes } = await turnOn2fa((await as(who)).page);
    const first = await logIn(browser, who);
    await first.page.getByPlaceholder("123456").fill(codes[0]);
    await first.page.getByRole("button", { name: "Verify" }).click();
    await expect(first.page).toHaveURL(/\/dashboard$/);

    const again = await logIn(browser, who);
    await again.page.getByPlaceholder("123456").fill(codes[0]);
    await again.page.getByRole("button", { name: "Verify" }).click();
    await expect(again.page).toHaveURL(/\/login$/);
    await again.page.getByPlaceholder("123456").fill(codes[1]); // a different one still works
    await again.page.getByRole("button", { name: "Verify" }).click();
    await expect(again.page).toHaveURL(/\/dashboard$/);
  });

  test("new backup codes need the password and replace the old ones", async ({ as, newPerson, browser }) => {
    const who = await newPerson();
    const { page } = await as(who);
    const { codes } = await turnOn2fa(page);
    await page.getByRole("button", { name: "New backup codes" }).click();
    await page.locator('input[name="password"]').fill("Wrong-password-1");
    await page.getByRole("button", { name: "Make new codes" }).click();
    await expect(page.getByText(/password is not right/)).toBeVisible();
    await page.locator('input[name="password"]').fill(who.password);
    await page.getByRole("button", { name: "Make new codes" }).click();
    await expect(page.getByText("Save these backup codes now.")).toBeVisible();
    const fresh = await page.locator("ul.font-mono li").allInnerTexts();
    expect(fresh).toHaveLength(10);
    expect(fresh).not.toContain(codes[0]);

    const old = await logIn(browser, who); // an old code no longer works
    await old.page.getByPlaceholder("123456").fill(codes[0]);
    await old.page.getByRole("button", { name: "Verify" }).click();
    await expect(old.page).toHaveURL(/\/login$/);
    await old.page.getByPlaceholder("123456").fill(fresh[0]); // a new one does
    await old.page.getByRole("button", { name: "Verify" }).click();
    await expect(old.page).toHaveURL(/\/dashboard$/);
  });

  test("turning it off needs the password and a code, and logging in is then plain again", async ({ as, newPerson, browser }) => {
    const who = await newPerson();
    const { page } = await as(who);
    const { secret } = await turnOn2fa(page);
    await page.getByRole("button", { name: "Turn off" }).click();
    await page.getByRole("button", { name: /^Turn off two-factor/ }).click();
    await expect(page.getByText("Enter your password and a code from your app")).toBeVisible();
    await page.locator('input[name="password"]').fill(who.password);
    await page.locator('input[name="code"]').fill("000000");
    await page.getByRole("button", { name: /^Turn off two-factor/ }).click();
    await expect(page.getByText("that code is not right")).toBeVisible();
    await page.locator('input[name="code"]').fill(totp(secret, 1));
    await page.getByRole("button", { name: /^Turn off two-factor/ }).click();
    await expect(page.getByRole("button", { name: "Set up two-factor" })).toBeVisible();

    const { page: p2 } = await logIn(browser, who);
    await expect(p2).toHaveURL(/\/dashboard$/); // no code asked for
  });
});
