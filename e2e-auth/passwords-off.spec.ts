import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BrowserContext, Page } from "@playwright/test";
import { API, expect, test } from "./fixtures";

// "Allow passwords" off: passkeys only. The shared test server keeps passwords on (other tests sign in with them), so the screens are checked
// with the server's answers replaced, and the server's own behaviour with a second API of its own that has passwords off.
const TMP = process.env.TMPDIR || "/tmp";
const BIN = join(TMP, "bedrock-e2e-auth-api");
const ADMIN = process.env.E2E_ADMIN_URL ?? "postgres://murtaza854@localhost:5432/postgres";
const BASE = ADMIN.slice(0, ADMIN.lastIndexOf("/"));
const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

async function authenticator(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
}

test.describe("Passwords off", () => {
  test("it cannot be turned off while people lack a passkey, and says who (owners need two)", async ({ owner }) => {
    const r = await owner.put(`${API}/admin/settings`, { data: { allow_passwords: "0" } });
    expect(r.status()).toBe(400);
    const text = await r.text();
    expect(text).toContain("once everyone has a passkey");
    expect(text).toContain("owner@e2e.test (0 of 2)");
    expect(text).toContain("editor@e2e.test (0 of 1)");
    const still = await (await owner.get(`${API}/settings`)).json();
    expect(String(JSON.stringify(still))).not.toContain('"allow_passwords":"0"'); // nothing changed
  });

  test("the sign-in page shows only the passkey button when passwords are off", async ({ page }) => {
    await page.route("**/config", (route) => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "http://localhost:3102", "access-control-allow-credentials": "true" }, body: JSON.stringify({ passwords: false }) }));
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toHaveCount(0);
    await expect(page.getByPlaceholder("Password")).toHaveCount(0);
    await expect(page.getByText("Forgot password?")).toHaveCount(0);
  });

  test("an invitation asks for a passkey instead of a password, signs the person in, and goes on to the wizard", async ({ owner, browser }) => {
    const email = `nopw${Date.now()}@e2e.test`;
    const { link } = await (await owner.post(`${API}/admin/users`, { data: { email, name: "", role: "viewer" } })).json();
    const context = await browser.newContext();
    const page = await context.newPage();
    await authenticator(context, page);
    await page.route("**/invite/lookup", async (route) => {
      const real = await route.fetch();
      await route.fulfill({ response: real, json: { ...(await real.json()), passwords: false } });
    });
    await page.goto(link);
    await expect(page.getByText("There is no password")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toHaveCount(0);
    await page.getByPlaceholder("Name, e.g. MacBook").fill("My laptop");
    await page.getByRole("button", { name: "Set up a passkey" }).click();
    await expect(page).toHaveURL(/\/onboarding$/); // signed in by the passkey, no password chosen
    const me = await (await context.request.get(`${API}/me`)).json();
    expect(me.passkeys).toBe(1);
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
    expect((await owner.post(`${API}/invite/lookup`, { data: { token: new URL(link).searchParams.get("token") } })).status()).toBe(400); // the link is spent
    await context.close();
  });

  test("with passwords off the server refuses password sign-in, password reset and choosing a password", async ({ playwright }) => {
    const db = "bedrock_e2e_pwoff", port = 8199, url = `http://localhost:${port}`;
    const env = { ...process.env, DATABASE_URL: `${BASE}/${db}`, DOCS_KEY: KEY, DOCS_DIR: join(TMP, "bedrock-pwoff-docs"), BACKUP_DIR: join(TMP, "bedrock-pwoff-backups"), BACKUPS: "0", DEV_NO_AUTH: "0", PORT: String(port), WEB_ORIGIN: "http://localhost:3102", MAIL_OUTBOX: join(TMP, "bedrock-pwoff-mail") };
    execFileSync("psql", [ADMIN, "-q", "-c", `drop database if exists ${db} with (force)`, "-c", `create database ${db}`]);
    let server: ReturnType<typeof spawn> | undefined;
    try {
      execFileSync(BIN, ["migrate"], { env, stdio: "ignore" });
      const made = spawnSync(BIN, ["adduser", "first@e2e.test", "owner", "First"], { env, encoding: "utf8" });
      const token = new URL(/https?:\/\/\S+/.exec(made.stderr)![0]).searchParams.get("token")!;
      execFileSync("psql", [`${BASE}/${db}`, "-q", "-c", "insert into settings(key, value) values ('allow_passwords', '0')"]);
      server = spawn(BIN, [], { env, stdio: "ignore" });
      const them = await playwright.request.newContext();
      await expect.poll(async () => (await them.get(`${url}/config`).catch(() => null))?.status(), { timeout: 20_000 }).toBe(200);

      expect(await (await them.get(`${url}/config`)).json()).toEqual({ passwords: false });
      const login = await them.post(`${url}/login`, { data: { email: "first@e2e.test", password: "Anything-at-all-1" } });
      expect(login.status()).toBe(403);
      expect(await login.text()).toContain("Passwords are turned off");
      expect((await them.post(`${url}/forgot`, { data: { email: "first@e2e.test" } })).status()).toBe(204); // same answer, but no mail
      expect((await them.post(`${url}/reset`, { data: { token: "x", password: "Granite-lantern-3092" } })).status()).toBe(403);
      const look = await (await them.post(`${url}/invite/lookup`, { data: { token } })).json();
      expect(look).toMatchObject({ email: "first@e2e.test", passwords: false });
      expect((await them.post(`${url}/invite/accept`, { data: { token, password: "Granite-lantern-3092" } })).status()).toBe(403);
      await new Promise((r) => setTimeout(r, 700));
      expect(existsSync(env.MAIL_OUTBOX) ? readFileSync(env.MAIL_OUTBOX, "utf8") : "").not.toContain("first@e2e.test"); // no reset email was sent
      await them.dispose();
    } finally {
      server?.kill();
      execFileSync("psql", [ADMIN, "-q", "-c", `drop database if exists ${db} with (force)`]);
    }
  });
});
