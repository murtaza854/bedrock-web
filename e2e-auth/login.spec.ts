import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API, PEOPLE, expect, test } from "./fixtures";

const OUTBOX = join(process.env.TMPDIR || "/tmp", "bedrock-e2e-auth-mail"); // where the test server writes the emails it "sends"

const fill = async (page: any, email: string, password: string) => {
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
};

test.describe("Log in", () => {
  test("needs an email and a password, and the email must look like one", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Enter your email")).toBeVisible();
    await expect(page.getByText("Enter your password")).toBeVisible();
    await page.getByPlaceholder("Email").fill("not-an-email");
    await page.getByPlaceholder("Password").fill("whatever-it-is");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });

  test("a wrong password and an unknown email give the same message, so nobody can find out who has an account", async ({ page }) => {
    await page.goto("/login");
    await fill(page, PEOPLE.owner.email, "definitely-wrong-1");
    await expect(page.getByText("Wrong email or password")).toBeVisible();
    await page.reload();
    await fill(page, "nobody@e2e.test", "definitely-wrong-2");
    await expect(page.getByText("Wrong email or password")).toBeVisible();
  });

  test("the eye button shows and hides the typed password", async ({ page }) => {
    await page.goto("/login");
    const box = page.getByPlaceholder("Password");
    await box.fill("Hunter2-hunter2-x");
    await expect(box).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(box).toHaveAttribute("type", "text");
    await expect(box).toHaveValue("Hunter2-hunter2-x"); // what was typed is still there
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(box).toHaveAttribute("type", "password");
  });

  test("signing in lands on the dashboard; Log out ends the session", async ({ page }) => {
    await page.goto("/login");
    await fill(page, PEOPLE.viewer.email, PEOPLE.viewer.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("link", { name: /Account/ })).toContainText(PEOPLE.viewer.email);
    await page.getByRole("link", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard/plots"); // the cookie is gone, so the app sends you back to log in
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a signed-out visitor is sent to log in from any page", async ({ page }) => {
    for (const path of ["/dashboard", "/dashboard/plots", "/dashboard/settings"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login$/);
    }
  });

  test("the API refuses anything without a session", async ({ request }) => {
    for (const path of ["/plots", "/me", "/stats", "/admin/users"]) expect((await request.get(`${API}${path}`)).status(), path).toBe(401);
    expect((await request.post(`${API}/plots`, { data: { area: "x", plot_no: "1" } })).status()).toBe(401);
  });
});

test.describe("Forgot and reset password", () => {
  test("the forgot link opens the form, which checks the email and then says to check your inbox", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot$/);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Enter your email", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Email").fill("bad");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await page.getByPlaceholder("Email").fill("someone@e2e.test");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText("someone@e2e.test")).toBeVisible();
    await page.getByRole("link", { name: "Back to log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a reset link with no token is not valid", async ({ page }) => {
    await page.goto("/reset");
    await expect(page.getByRole("heading", { name: "Link not valid" })).toBeVisible();
    await page.getByRole("link", { name: "Request a new link" }).click();
    await expect(page).toHaveURL(/\/forgot$/);
  });

  test("the new password must be long enough and typed twice the same", async ({ page }) => {
    await page.goto("/reset?token=abc");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Enter a new password")).toBeVisible();
    await expect(page.getByText("Repeat the new password")).toBeVisible();
    await page.getByPlaceholder("New password", { exact: true }).fill("short");
    await page.getByPlaceholder("Repeat new password").fill("short");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Use at least 12 characters", { exact: true })).toBeVisible();
    await page.getByPlaceholder("New password", { exact: true }).fill("a-long-enough-pass");
    await page.getByPlaceholder("Repeat new password").fill("a-different-pass1");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Passwords don't match")).toBeVisible();
    await page.getByPlaceholder("Repeat new password").fill("a-long-enough-pass");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("expired or was already used")).toBeVisible(); // this token was never issued
  });

  test("an emailed link sets a new password once; an unknown email gets the same answer and no mail; requests are limited", async ({ page, request, newPerson }) => {
    const who = await newPerson("viewer");
    const mails = (to: string) => { try { return readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.to === to); } catch { return []; } };
    await page.goto("/forgot");
    await page.getByPlaceholder("Email").fill(who.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect.poll(() => mails(who.email).length).toBe(1);
    const link = /http\S+\/reset\?token=\w+/.exec(mails(who.email)[0].body)![0];

    await page.goto(link);
    await page.getByPlaceholder("New password", { exact: true }).fill("Brand-new-pass-1");
    await page.getByPlaceholder("Repeat new password").fill("Brand-new-pass-1");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
    expect((await request.post(`${API}/login`, { data: { email: who.email, password: who.password } })).status()).toBe(401); // the old one is gone
    expect((await request.post(`${API}/login`, { data: { email: who.email, password: "Brand-new-pass-1" } })).status()).toBe(204);

    await page.goto(link); // a link works once
    await page.getByPlaceholder("New password", { exact: true }).fill("Another-pass-123");
    await page.getByPlaceholder("Repeat new password").fill("Another-pass-123");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("expired or was already used")).toBeVisible();

    const nobody = `nobody${Date.now()}@e2e.test`; // no account: the same screen, and nothing is sent
    await page.goto("/forgot");
    await page.getByPlaceholder("Email").fill(nobody);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await page.waitForTimeout(1000);
    expect(mails(nobody)).toHaveLength(0);

    const spam = (await newPerson("viewer")).email; // three an hour per email, then it is ignored
    for (let i = 0; i < 5; i++) expect((await request.post(`${API}/forgot`, { data: { email: spam } })).status()).toBe(204);
    await expect.poll(() => mails(spam).length).toBe(3);
    await page.waitForTimeout(1000);
    expect(mails(spam)).toHaveLength(3);
  });
});
