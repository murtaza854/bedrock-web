import { execFileSync } from "node:child_process";
import { API, PEOPLE, expect, test } from "./fixtures";
import { totp } from "./totp";

// Sign-in safety: nobody is locked out, wrong answers are slow, sessions are short, two-factor can be required,
// weak passwords are refused, and the server sets its protective headers. The test server runs with a 400 ms delay on wrong answers.
const ADMIN = process.env.E2E_ADMIN_URL ?? "postgres://murtaza854@localhost:5432/postgres";
const sql = (q: string) => execFileSync("psql", [`${ADMIN.slice(0, ADMIN.lastIndexOf("/"))}/bedrock_e2e_auth`, "-tAq", "-c", q], { encoding: "utf8" }).trim();
const login = (request: any, email: string, password: string, headers: Record<string, string> = {}) => request.post(`${API}/login`, { data: { email, password }, headers });

test.describe("Sign-in safety", () => {
  test("repeated wrong passwords never lock anyone out: each wrong answer is slow, and the right password still works at once", async ({ request, newPerson }) => {
    const who = await newPerson("viewer");
    const wrong: number[] = [];
    for (let i = 0; i < 7; i++) { const t = Date.now(); expect((await login(request, who.email, "wrong-password-1")).status()).toBe(401); wrong.push(Date.now() - t); }
    expect(Math.min(...wrong)).toBeGreaterThanOrEqual(350); // slowed, whoever is asking
    const t = Date.now();
    expect((await login(request, who.email, who.password)).status()).toBe(204); // no lock, and no delay for the right one
    expect(Date.now() - t).toBeLessThan(350);
    const unknown = Date.now();
    expect((await login(request, `nobody${Date.now()}@e2e.test`, "wrong-password-1")).status()).toBe(401);
    expect(Date.now() - unknown).toBeGreaterThanOrEqual(350); // an email that does not exist is just as slow
  });

  test("a change request that comes from another website is refused; the API sends protective headers", async ({ request }) => {
    expect((await login(request, PEOPLE.viewer.email, PEOPLE.viewer.password, { Origin: "http://evil.example" })).status()).toBe(403);
    expect((await login(request, PEOPLE.viewer.email, "wrong-password-1", { Origin: "http://localhost:3102" })).status()).toBe(401); // from Bedrock itself it is judged as usual
    const r = await request.get(`${API}/me`);
    const h = r.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("no-referrer");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["cache-control"]).toContain("no-store");
  });

  test("a session ends after a day of not being used, and after a week whatever happens", async ({ request, newPerson }) => {
    const who = await newPerson("viewer");
    const r = await login(request, who.email, who.password);
    expect(r.status()).toBe(204);
    const days = (Date.parse(/expires=([^;]+)/i.exec(r.headers()["set-cookie"])![1]) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9); expect(days).toBeLessThan(7.1); // the cookie itself lasts a week
    expect((await request.get(`${API}/me`)).status()).toBe(200);
    sql(`update sessions set last_seen_at = now() - interval '13 hours' where user_id = (select id from users where email = '${who.email}')`);
    expect((await request.get(`${API}/me`)).status()).toBe(401); // unused for 13 hours
    expect((await login(request, who.email, who.password)).status()).toBe(204);
    sql(`update sessions set expires_at = now() - interval '1 minute' where user_id = (select id from users where email = '${who.email}')`);
    expect((await request.get(`${API}/me`)).status()).toBe(401); // past its week
  });

  test("weak passwords are refused when a person is added: too short, too common, or built from the email", async ({ owner }) => {
    const add = (email: string, password: string) => owner.post(`${API}/admin/users`, { data: { email, password, name: "", role: "viewer" } });
    const e = (n: string) => `${n}${Date.now()}@e2e.test`;
    for (const [pw, why] of [["Sh0rt-1", "at least 8"], ["alllowercase-and-1", "uppercase letter"], ["NoSymbols1AtAll", "a symbol"], ["Password123456!", "too common"], ["Aa1!Aa1!Aa1!", "repetitive"]] as const) {
      const r = await add(e("weak"), pw);
      expect(r.status(), pw).toBe(400);
      expect(await r.text()).toContain(why);
    }
    const mail = `jordanlee@e${Date.now()}.test`;
    const r = await add(mail, "JordanLee-2026-xyz");
    expect(r.status()).toBe(400);
    expect(await r.text()).toContain("must not contain the email");
    expect((await add(e("good"), "Three-unrelated-words-9")).ok()).toBeTruthy();
  });

  test("when two-factor is required, a person without it can only open Account until they turn it on, and cannot turn it off", async ({ as, owner, newPerson }) => {
    const who = await newPerson("viewer");
    const { page, request } = await as(who);
    try {
      expect((await owner.put(`${API}/admin/settings`, { data: { require_2fa: "1" } })).ok()).toBeTruthy();
      await page.waitForTimeout(500);
      const blocked = await request.get(`${API}/plots`);
      expect(blocked.status()).toBe(403);
      expect(await blocked.text()).toContain("two-factor");
      expect((await (await request.get(`${API}/me`)).json()).must_setup_2fa).toBe(true); // /me, /logout and /account still work

      await page.goto("/dashboard/plots"); // every other page sends them to the setup wizard
      await expect(page).toHaveURL(/\/onboarding$/);
      await expect(page.getByRole("heading", { name: "Secure your account" })).toBeVisible();

      const { secret } = await (await request.post(`${API}/account/2fa/setup`, { data: {} })).json();
      expect((await request.post(`${API}/account/2fa/enable`, { data: { code: totp(secret, -1), code2: totp(secret) } })).ok()).toBeTruthy();
      expect((await request.get(`${API}/plots`)).status()).toBe(200); // now everything opens (not invited, so no Finish step)
      await page.reload();
      await page.goto("/dashboard/plots");
      await expect(page).toHaveURL(/\/dashboard\/plots$/);
      const off = await request.post(`${API}/account/2fa/disable`, { data: { password: who.password, code: totp(secret, 1) } });
      expect(off.status()).toBe(400);
      expect(await off.text()).toContain("required for everyone");
    } finally {
      // the owner has no two-factor either, so the API would refuse the owner too: put it back in the database and let the server's 10-second settings cache expire
      sql(`update settings set value = '0' where key = 'require_2fa'`);
      await page.waitForTimeout(10_500);
    }
  });
});
