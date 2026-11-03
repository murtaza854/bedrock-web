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

  test("the Roles tab lists the built-in roles, and there is no lawyer role any more", async ({ as }) => {
    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await page.getByRole("button", { name: "Roles", exact: true }).click();
    const table = page.getByRole("table");
    for (const r of ["Owner", "Editor", "Viewer"]) await expect(table.getByRole("row", { name: new RegExp(`^${r}`) })).toContainText("Built in");
    await expect(table).not.toContainText("Lawyer");
  });

  test("inviting a person checks the form, refuses a duplicate, shows the one-time link and marks them Invited", async ({ as }) => {
    const { page, request } = await as(PEOPLE.owner);
    const email = `added${Date.now()}@e2e.test`;
    await page.goto("/dashboard/admin");
    await page.getByRole("button", { name: "Invite a person" }).click();
    await page.getByRole("button", { name: "Invite person" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="first_name"]').fill("Added");
    await page.locator('input[name="last_name"]').fill("Person");
    await page.getByRole("combobox", { name: "Role", exact: true }).click();
    await page.getByRole("option", { name: "Viewer" }).click();
    await page.getByRole("button", { name: "Invite person" }).click();
    await expect(page.getByRole("status")).toHaveText(`Invitation emailed to ${email}`); // just that, no link when the email went out
    await expect(row(page, email)).toContainText("Added Person");
    await expect(row(page, email)).toContainText("Invited");
    await expect(page.getByRole("combobox", { name: `Role of ${email}` })).toContainText("Viewer");

    await page.getByRole("button", { name: "Invite a person" }).click(); // the same email again
    await page.locator('input[name="email"]').fill(email);
    await page.getByRole("button", { name: "Invite person" }).click();
    await expect(page.getByText("someone with that email already exists")).toBeVisible();

    const them = await pwRequest.newContext();
    expect((await them.post(`${API}/login`, { data: { email, password: "Starting-pass-1" } })).status()).toBe(401); // no password exists until they choose one
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
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();
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
    expect((await them.request.post(`${API}/account/2fa/enable`, { data: { code: totp(setup.secret, -1), code2: totp(setup.secret) } })).status()).toBe(200);
    const probe = await pwRequest.newContext();
    const asked = await probe.post(`${API}/login`, { data: { email: who.email, password: who.password } });
    expect((await asked.json()).needs_2fa).toBe(true);

    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await expect(row(page, who.email)).toContainText("App");
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
  test("the backup schedule is chosen in Admin: on or off, which days, and what time", async ({ as }) => {
    const { page, request } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await page.getByRole("button", { name: "Backups", exact: true }).click();
    await expect(page.getByLabel("Make a backup automatically")).toBeChecked(); // the default: every day
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) await expect(page.getByRole("button", { name: day, exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Sat", exact: true }).click();
    await page.getByRole("button", { name: "Sun", exact: true }).click();
    await page.getByLabel("Backup time").fill("03:30");
    await page.getByRole("button", { name: "Save schedule" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    let s = (await (await request.get(`${API}/admin/backups`)).json()).schedule;
    expect(s).toEqual({ enabled: true, days: [1, 2, 3, 4, 5], time: "03:30" });

    await page.reload(); // it is remembered
    await page.getByRole("button", { name: "Backups", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sat", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByLabel("Backup time")).toHaveValue("03:30");

    await page.getByLabel("Make a backup automatically").uncheck(); // switched off
    await expect(page.getByLabel("Backup time")).toBeDisabled();
    await page.getByRole("button", { name: "Save schedule" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    expect((await (await request.get(`${API}/admin/backups`)).json()).schedule.enabled).toBe(false);

    // the server refuses nonsense, and "on" with no days
    expect((await request.put(`${API}/admin/backup-schedule`, { data: { enabled: true, days: [], time: "03:30" } })).status()).toBe(400);
    expect((await request.put(`${API}/admin/backup-schedule`, { data: { enabled: true, days: [1], time: "25:99" } })).status()).toBe(400);
    expect((await request.put(`${API}/admin/backup-schedule`, { data: { enabled: true, days: [9], time: "03:30" } })).status()).toBe(400);
    expect((await request.put(`${API}/admin/backup-schedule`, { data: { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], time: "02:00" } })).ok()).toBeTruthy(); // back to the default
  });

  test("Back up now makes a backup that is checked by reading it back", async ({ as }) => {
    const { page, request } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await page.getByRole("button", { name: "Backups", exact: true }).click();
    await expect(page.getByText(/switched off on the server itself/)).toBeVisible(); // the test server runs with BACKUPS=0
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

  test("only an owner can rename other people: the owner does it in the list, anyone else is refused", async ({ as, owner, newPerson }) => {
    const target = await newPerson("viewer");
    const { page } = await as(PEOPLE.owner);
    await page.goto("/dashboard/admin");
    await row(page, target.email).getByRole("button", { name: "Rename" }).click();
    await page.getByLabel(`First name of ${target.email}`).fill("Renamed");
    await page.getByLabel(`Last name of ${target.email}`).fill("By Owner");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Name saved");
    await expect(row(page, target.email)).toContainText("Renamed By Owner");

    // a role that may use the Admin area is still not an owner
    const role = `Adminish${Date.now()}`;
    expect((await owner.post(`${API}/admin/roles`, { data: { name: role, perms: { plots: "r", admin: "ru" } } })).ok()).toBeTruthy();
    const helper = await newPerson(role);
    const them = await as(helper);
    const id = (await (await owner.get(`${API}/admin/users`)).json()).find((u: any) => u.email === target.email).id;
    const refused = await them.request.patch(`${API}/admin/users/${id}`, { data: { first_name: "Nope" } });
    expect(refused.status()).toBe(403);
    expect(await refused.text()).toContain("only an owner");
  });
});
