import { request as pwRequest } from "@playwright/test";
import { API, PEOPLE, expect, login, test } from "./fixtures";
import { totp } from "./totp";

const row = (page: any, email: string) => page.locator("tbody tr", { hasText: email });

test.describe("People", () => {
  test("lists everyone with their role, marks you, and will not let you change yourself", async ({ as }) => {
    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    for (const p of Object.values(PEOPLE)) await expect(row(page, p.email)).toBeVisible();
    await expect(row(page, PEOPLE.owner.email)).toContainText("You");
    await expect(page.getByRole("combobox", { name: `Role of ${PEOPLE.owner.email}` })).toBeDisabled();
    await expect(row(page, PEOPLE.owner.email).getByRole("button", { name: /Switch off/ })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: `Role of ${PEOPLE.viewer.email}` })).toContainText("Viewer");
  });

  test("the role list explains each role, and there is no lawyer role any more", async ({ as }) => {
    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    const roles = page.locator("section", { has: page.getByRole("heading", { name: "What each role can do" }) });
    for (const r of ["Owner", "Editor", "Viewer"]) await expect(roles).toContainText(r);
    await expect(roles).not.toContainText("Lawyer");
  });

  test("adding a person checks the form, refuses a duplicate, and the new person can sign in", async ({ as }) => {
    const { page, request } = await as(PEOPLE.owner);
    const email = `added${Date.now()}@e2e.test`;
    await page.goto("/dashboard/admin");
    await page.getByRole("button", { name: "Add a person" }).click();
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Use at least 10 characters")).toBeVisible();

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="name"]').fill("Added Person");
    await page.getByRole("combobox", { name: "Role", exact: true }).click();
    await page.getByRole("option", { name: "Viewer" }).click();
    await page.locator('input[name="password"]').fill("Starting-pass-1");
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(row(page, email)).toContainText("Added Person");
    await expect(page.getByRole("combobox", { name: `Role of ${email}` })).toContainText("Viewer");

    await page.getByRole("button", { name: "Add a person" }).click(); // the same email again
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill("Starting-pass-1");
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(page.getByText("someone with that email already exists")).toBeVisible();

    const them = await pwRequest.newContext();
    await login(them, email, "Starting-pass-1");
    await them.dispose();
    expect((await request.get(`${API}/admin/users`)).status()).toBe(200);
  });

  test("changing someone's role takes effect at once: they are signed out and come back with the new rights", async ({ as, newPerson }) => {
    const who = await newPerson("editor");
    const them = await as(who);
    expect((await them.request.get(`${API}/negotiations`)).status()).toBe(200); // an editor sees money
    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await page.getByRole("combobox", { name: `Role of ${who.email}` }).click();
    await page.getByRole("option", { name: "Viewer" }).click();
    await expect(page.getByRole("status")).toContainText(`${who.email} is now a viewer`);
    expect((await them.request.get(`${API}/plots`)).status()).toBe(401); // the old session is gone
    const again = await as(who);
    expect((await again.request.get(`${API}/negotiations`)).status()).toBe(403); // and the new one has the new rights
  });

  test("you cannot change your own role or switch yourself off", async ({ as }) => {
    const { request } = await as(PEOPLE.owner);
    const users = await (await request.get(`${API}/admin/users`)).json();
    const me = users.find((u: any) => u.email === PEOPLE.owner.email);
    const demote = await request.patch(`${API}/admin/users/${me.id}`, { data: { role: "viewer" } });
    expect(demote.status()).toBe(400);
    expect(await demote.text()).toContain("can't change your own role");
    expect((await request.patch(`${API}/admin/users/${me.id}`, { data: { disabled: true } })).status()).toBe(400);
  });

  test("setting a password needs ten characters, then signs the person out and the new password works", async ({ as, newPerson }) => {
    const who = await newPerson();
    const them = await as(who);
    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await row(page, who.email).getByRole("button", { name: "Set password" }).click();
    await page.getByPlaceholder("New password").fill("short");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByText("Use at least 10 characters")).toBeVisible();
    await page.getByPlaceholder("New password").fill("Reset-by-owner-1");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Password set. They were signed out everywhere.");

    expect((await them.request.get(`${API}/plots`)).status()).toBe(401);
    const probe = await pwRequest.newContext();
    expect((await probe.post(`${API}/login`, { data: { email: who.email, password: who.password } })).status()).toBe(401);
    expect((await probe.post(`${API}/login`, { data: { email: who.email, password: "Reset-by-owner-1" } })).status()).toBe(204);
    await probe.dispose();
  });

  test("switching someone off blocks their sign-in, and switching them back on restores it", async ({ as, newPerson }) => {
    const who = await newPerson();
    const them = await as(who);
    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await row(page, who.email).getByRole("button", { name: "Switch off" }).click();
    await row(page, who.email).getByRole("button", { name: "Cancel" }).click(); // changed my mind
    await expect(row(page, who.email)).not.toContainText("Switched off");
    await row(page, who.email).getByRole("button", { name: "Switch off" }).click();
    await row(page, who.email).getByRole("button", { name: "Confirm" }).click();
    await expect(row(page, who.email)).toContainText("Switched off");

    expect((await them.request.get(`${API}/plots`)).status()).toBe(401); // signed out at once
    const probe = await pwRequest.newContext();
    expect((await probe.post(`${API}/login`, { data: { email: who.email, password: who.password } })).status()).toBe(401);
    await row(page, who.email).getByRole("button", { name: "Switch on" }).click();
    await row(page, who.email).getByRole("button", { name: "Confirm" }).click();
    await expect(row(page, who.email)).not.toContainText("Switched off");
    expect((await probe.post(`${API}/login`, { data: { email: who.email, password: who.password } })).status()).toBe(204);
    await probe.dispose();
  });

  test("an owner can reset someone's two-factor, so they can log in with just a password again", async ({ as, newPerson }) => {
    const who = await newPerson();
    const them = await as(who);
    const setup = await (await them.request.post(`${API}/account/2fa/setup`, { data: {} })).json();
    expect((await them.request.post(`${API}/account/2fa/enable`, { data: { code: totp(setup.secret) } })).status()).toBe(200);
    const probe = await pwRequest.newContext();
    const asked = await probe.post(`${API}/login`, { data: { email: who.email, password: who.password } });
    expect((await asked.json()).needs_2fa).toBe(true);

    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await expect(row(page, who.email)).toContainText("On");
    await row(page, who.email).getByRole("button", { name: "Reset two-factor" }).click();
    await row(page, who.email).getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("status")).toContainText("Two-factor reset");
    await expect(row(page, who.email).getByRole("button", { name: "Reset two-factor" })).toHaveCount(0);
    expect((await probe.post(`${API}/login`, { data: { email: who.email, password: who.password } })).status()).toBe(204);
    await probe.dispose();
  });

  test("the summary counts match the server's own", async ({ as }) => {
    const { page, request } = await as(PEOPLE.owner);
    const s = await (await request.get(`${API}/admin/summary`)).json();
    await page.goto("/dashboard/admin");
    const kpi = (name: string) => page.locator("div", { has: page.locator("p", { hasText: new RegExp(`^${name}$`) }) }).last();
    await expect(kpi("People")).toContainText(String(s.users));
    await expect(kpi("Without two-factor")).toContainText(String(s.without_2fa));
    expect(s.owners).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Audit log", () => {
  test("records sign-ins, failed sign-ins and refused actions, and the filters narrow them", async ({ as, newPerson }) => {
    const who = await newPerson("viewer");
    const viewer = await as(who);
    expect((await viewer.request.post(`${API}/plots`, { data: { area: "x", plot_no: "AUD-1" } })).status()).toBe(403); // refused and recorded
    const probe = await pwRequest.newContext();
    expect((await probe.post(`${API}/login`, { data: { email: who.email, password: "wrong-password-9" } })).status()).toBe(401);
    await probe.dispose();

    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await page.getByRole("button", { name: "Audit log" }).click();
    await page.getByPlaceholder("Search what happened").fill("denied");
    const denied = page.locator("tbody tr", { hasText: who.email });
    await expect(denied.first()).toContainText("denied: POST /plots");
    await expect(denied.first()).toContainText("403");

    await page.getByPlaceholder("Search what happened").fill("login failed");
    await expect(page.locator("tbody tr", { hasText: "login failed" }).first()).toContainText("401");

    await page.getByPlaceholder("Search what happened").fill("");
    await page.getByLabel("Failures and refusals only").check();
    await expect.poll(async () => {
      const badges = await page.locator("tbody tr td:nth-child(4)").allInnerTexts();
      return badges.length > 0 && badges.every((t) => Number(t) >= 400);
    }).toBe(true);
  });

  test("can be narrowed to one person", async ({ as, newPerson }) => {
    const who = await newPerson("editor");
    const them = await as(who);
    await them.request.post(`${API}/plots`, { data: { area: "Audit Area", plot_no: "AUD-ONE", size_sqyd: 400 } });
    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await page.getByRole("button", { name: "Audit log" }).click();
    await page.getByRole("combobox", { name: "Person" }).click();
    await page.getByRole("option", { name: who.email }).click();
    await expect(page.locator("tbody tr").first()).toContainText(who.email);
    await expect.poll(async () => (await page.locator("tbody tr").allInnerTexts()).every((t) => t.includes(who.email))).toBe(true);
    await expect(page.locator("tbody tr", { hasText: "POST /plots" }).first()).toBeVisible();
  });
});

test.describe("Backups", () => {
  test("Back up now makes a backup that is checked by reading it back", async ({ as }) => {
    const { page, request } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await page.getByRole("button", { name: "Backups" }).click();
    await expect(page.getByText("Automatic backups are switched off on this server.")).toBeVisible();
    await page.getByRole("button", { name: "Back up now" }).click();
    const first = page.locator("tbody tr").first();
    await expect(first).toContainText("By hand");
    await expect(first).toContainText("Restores correctly");
    await expect(first.getByRole("link", { name: "Database" })).toBeVisible();

    const list = await (await request.get(`${API}/admin/backups`)).json();
    expect(list.backups[0].error).toBe("");
    expect(list.backups[0].verified).toBe(true);
    const dl = await request.get(`${API}/admin/backups/${list.backups[0].id}/download?which=db`);
    expect(dl.status()).toBe(200);
    expect((await dl.body()).length).toBeGreaterThan(1000); // an encrypted database dump, not an empty file
  });
});
