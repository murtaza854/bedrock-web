import { API, expect, test } from "./fixtures";

// The on/off settings are Yes/No dropdowns, not 1 and 0.
test("Settings shows Yes/No dropdowns for the on/off rules, and saving one works", async ({ as, owner }) => {
  const { page } = await as({ email: "owner@e2e.test", password: "Owner-pass-12345" });
  try {
    await page.goto("/dashboard/settings");
    const alerts = page.getByRole("combobox", { name: "Copy sign-in alerts to owners" });
    await expect(alerts).toContainText("Yes");
    await expect(page.getByText("1 = yes, 0 = no")).toHaveCount(0);
    await alerts.click();
    await page.getByRole("option", { name: "No" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved. The whole app uses these now.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Copy sign-in alerts to owners" })).toContainText("No");
    expect((await (await owner.get(`${API}/settings`)).json()).values.signin_alerts_owners).toBe(0);
  } finally {
    await owner.put(`${API}/admin/settings`, { data: { signin_alerts_owners: "" } }); // back to the default
  }
});

test("a director sees no Settings or Admin link in the sidebar", async ({ as, newPerson }) => {
  const { page } = await as(await newPerson("director"));
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Plots" })).toBeVisible();
});
