import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { API, PEOPLE, expect, test } from "./fixtures";
import { totp } from "./totp";

// Invitations: a person is added without a password, opens a one-time link, chooses a password, and must turn on two-factor before anything else opens.
const BIN = join(process.env.TMPDIR || "/tmp", "bedrock-e2e-auth-api");
const ADMIN = process.env.E2E_ADMIN_URL ?? "postgres://murtaza854@localhost:5432/postgres";
const DB = `${ADMIN.slice(0, ADMIN.lastIndexOf("/"))}/bedrock_e2e_auth`;
const tokenOf = (link: string) => new URL(link).searchParams.get("token")!;

test.describe("Invitations", () => {
  test("an invited person chooses a password from the link, then can only open Account until two-factor is on; the link works once", async ({ owner, as, browser }) => {
    const email = `invited${Date.now()}@e2e.test`;
    const made = await owner.post(`${API}/admin/users`, { data: { email, name: "Invited Person", role: "viewer" } });
    expect(made.ok(), await made.text()).toBeTruthy();
    const { link } = await made.json();
    expect(link).toContain("/welcome?token=");

    // nothing opens before the link is used
    expect((await owner.post(`${API}/login`, { data: { email, password: "Anything-at-all-1" } })).status()).toBe(401);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(link);
    await expect(page.getByText(`Choose a password for ${email}`)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose a password", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Password", { exact: true }).fill("short");
    await page.getByPlaceholder("Repeat password").fill("short");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Use at least 8 characters", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Password", { exact: true }).fill("Walnut-bridge-4417");
    await page.getByPlaceholder("Repeat password").fill("Walnut-bridge-4417");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.goto("/dashboard/plots"); // every other page sends them back to the wizard
    await expect(page).toHaveURL(/\/onboarding$/);

    const request = ctx.request; // signed in by the link
    expect((await request.get(`${API}/plots`)).status()).toBe(403);
    expect((await (await request.get(`${API}/me`)).json()).onboarding).toBe(true);
    const { secret } = await (await request.post(`${API}/account/2fa/setup`, { data: {} })).json();
    const on = await request.post(`${API}/account/2fa/enable`, { data: { code: totp(secret, -1), code2: totp(secret) } });
    expect(on.ok()).toBeTruthy();
    expect((await on.json()).backup_codes.length).toBeGreaterThan(0);
    expect((await request.get(`${API}/plots`)).status()).toBe(403); // still held: Finish is the last step
    expect((await request.post(`${API}/account/onboarding/finish`, { data: {} })).status()).toBe(204);
    expect((await request.get(`${API}/plots`)).status()).toBe(200);
    expect((await (await request.get(`${API}/me`)).json()).onboarding).toBe(false);

    // the link is spent
    const again = await owner.post(`${API}/invite/accept`, { data: { token: tokenOf(link), password: "Another-long-one-77" } });
    expect(again.status()).toBe(400);
    expect((await owner.post(`${API}/invite/lookup`, { data: { token: tokenOf(link) } })).status()).toBe(400);
    await ctx.close();
    // and they can sign in with the password they chose (the second step is the code)
    expect((await owner.post(`${API}/login`, { data: { email, password: "Walnut-bridge-4417" } })).status()).toBe(200);
  });

  test("a new link replaces the old one; make invite does the same from the command line and refuses people who are set up", async ({ owner, playwright }) => {
    const email = `again${Date.now()}@e2e.test`;
    const first = await (await owner.post(`${API}/admin/users`, { data: { email, name: "", role: "viewer" } })).json();
    const id = first.id;
    const second = await (await owner.post(`${API}/admin/users/${id}/invite`, { data: {} })).json();
    expect(second.link).not.toBe(first.link);
    expect((await owner.post(`${API}/invite/lookup`, { data: { token: tokenOf(first.link) } })).status()).toBe(400);
    expect((await owner.post(`${API}/invite/lookup`, { data: { token: tokenOf(second.link) } })).status()).toBe(200);

    const cli = spawnSync(BIN, ["invite", email, "Named By Command"], { env: { ...process.env, DATABASE_URL: DB, DOCS_KEY: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff", DOCS_DIR: join(process.env.TMPDIR || "/tmp", "bedrock-adduser-docs") }, encoding: "utf8" });
    expect(cli.status, cli.stderr).toBe(0);
    const link = /https?:\/\/\S+/.exec(cli.stderr)![0];
    expect((await (await owner.get(`${API}/admin/users`)).json()).find((u: any) => u.email === email).name).toBe("Named By Command");
    expect((await owner.post(`${API}/invite/lookup`, { data: { token: tokenOf(second.link) } })).status()).toBe(400);
    const stranger = await playwright.request.newContext(); // accepting signs that visitor in, so it is not done as the owner
    const accepted = await stranger.post(`${API}/invite/accept`, { data: { token: tokenOf(link), password: "Granite-lantern-3092" } });
    expect(accepted.status()).toBe(204);
    expect((await owner.post(`${API}/admin/users/${id}/invite`, { data: {} })).status()).toBe(400); // already chosen
    const refused = spawnSync(BIN, ["invite", PEOPLE.owner.email], { env: { ...process.env, DATABASE_URL: DB, DOCS_KEY: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff", DOCS_DIR: join(process.env.TMPDIR || "/tmp", "bedrock-adduser-docs") }, encoding: "utf8" });
    expect(refused.status).not.toBe(0);
  });

  test("a weak password is refused on the link and the link still works afterwards, and a bad token is refused", async ({ owner }) => {
    const email = `weak${Date.now()}@e2e.test`;
    const { link } = await (await owner.post(`${API}/admin/users`, { data: { email, name: "", role: "viewer" } })).json();
    const weak = await owner.post(`${API}/invite/accept`, { data: { token: tokenOf(link), password: "Password123456!" } });
    expect(weak.status()).toBe(400);
    expect((await owner.post(`${API}/invite/lookup`, { data: { token: tokenOf(link) } })).status()).toBe(200);
    expect((await owner.post(`${API}/invite/accept`, { data: { token: "nope", password: "Granite-lantern-3092" } })).status()).toBe(400);
  });
});
