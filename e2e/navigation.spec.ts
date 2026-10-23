import { expect, test } from "./fixtures";

test("the sidebar offers the current modules and none of the removed ones", async ({ page }) => {
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation");
  for (const name of ["Overview", "Tasks", "Plots", "Map", "Offers", "Contacts", "Bylaws", "Scorecard", "Settings", "Admin"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  }
  for (const name of ["Documents", "Legal", "Inspections", "Payments", "Finance", "Analytics", "Reports"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(0);
  }
});

test("removed module pages are gone", async ({ page }) => {
  for (const path of ["documents", "legal", "inspections", "payments", "finance", "analytics", "reports"]) {
    const r = await page.goto(`/dashboard/${path}`);
    expect(r?.status(), path).toBe(404);
  }
});

test("rates screen lives under Settings", async ({ page }) => {
  await page.goto("/dashboard/settings/rates");
  await expect(page.getByRole("heading", { name: "Tax and fee rates" })).toBeVisible();
  await expect(page.getByText("Stamp duty")).toBeVisible();
});
