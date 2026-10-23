import { expect, test } from "./fixtures";

test.describe("Sidebar", () => {
  test("collapses to icons, remembers that after a reload, and expands again", async ({ page }) => {
    await page.goto("/dashboard");
    const aside = page.getByRole("complementary");
    await expect(aside).toHaveClass(/w-56/);
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(aside).toHaveClass(/w-16/);
    await expect(page.getByRole("link", { name: "Plots" })).toHaveAttribute("title", "Plots"); // icon-only, so the name moves to a tooltip
    await page.reload();
    await expect(aside).toHaveClass(/w-16/);
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(aside).toHaveClass(/w-56/);
  });

  test("the current page is marked, including inside a section", async ({ page, plot }) => {
    const p = await plot({ plot_no: "NAV-1" });
    await page.goto("/dashboard");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Plots", exact: true })).not.toHaveAttribute("aria-current", "page");
    await page.goto(`/dashboard/plots/${p.id}/financials`);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Plots", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current", "page");
  });

  test("every sidebar link opens a page that loads", async ({ page }) => {
    await page.goto("/dashboard");
    const links = await page.getByRole("navigation").getByRole("link").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const href of links) {
      const r = await page.goto(href);
      expect(r?.status(), href).toBeLessThan(400);
      await expect(page.getByRole("main"), href).toBeVisible();
    }
  });
});

test.describe("Theme", () => {
  test("light and dark apply at once and are remembered", async ({ page }) => {
    await page.goto("/dashboard");
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    await page.getByRole("button", { name: "dark", exact: true }).click();
    expect(await theme()).toBe("dark");
    await page.reload();
    expect(await theme()).toBe("dark");
    await expect(page.getByRole("button", { name: "dark", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "light", exact: true }).click();
    expect(await theme()).toBe("light");
    await page.reload();
    expect(await theme()).toBe("light");
  });

  test("System follows the operating system", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "system", exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  });

  test("the saved theme is applied before the page paints, so nothing flashes", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/login");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  });
});

test.describe("Account in development mode", () => {
  test("says plainly that sign-in is switched off, with nothing to change", async ({ page }) => {
    await page.goto("/dashboard/account");
    await expect(page.getByText(/Login is switched off while you build/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Change password" })).toHaveCount(0);
  });
});
