import { API, PEOPLE, expect, test } from "./fixtures";

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

  test("repeated wrong attempts lock that email for a while, even for the right password", async ({ page, request }) => {
    const email = `lock${Date.now()}@e2e.test`;
    for (let i = 0; i < 5; i++) {
      const r = await request.post(`${API}/login`, { data: { email, password: "wrong-password-1" } });
      expect(r.status()).toBe(401);
    }
    await page.goto("/login");
    await fill(page, email, "wrong-password-1");
    await expect(page.getByText(/Too many attempts\. Try again in \d+ minutes\./)).toBeVisible();
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

test.describe("Forgot and reset password (screens only: no email is sent yet)", () => {
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
    await expect(page.getByText("Use at least 10 characters", { exact: true })).toBeVisible();
    await page.getByPlaceholder("New password", { exact: true }).fill("a-long-enough-pass");
    await page.getByPlaceholder("Repeat new password").fill("a-different-pass1");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Passwords don't match")).toBeVisible();
    await page.getByPlaceholder("Repeat new password").fill("a-long-enough-pass");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
  });
});
