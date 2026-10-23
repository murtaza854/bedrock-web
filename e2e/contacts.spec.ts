import { API, expect, test } from "./fixtures";

const today = () => new Date().toLocaleDateString("en-CA");

async function contact(request: any, data: Record<string, unknown>) {
  const r = await request.post(`${API}/contacts`, { data: { phone: "", email: "", company: "", notes: "", roles: ["broker"], ...data } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

test.describe("Adding and editing", () => {
  test("the form checks every field, then saves and lists the contact", async ({ page }) => {
    await page.goto("/dashboard/contacts/new");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText("Enter a name")).toBeVisible();
    await expect(page.getByText("Pick at least one role")).toBeVisible();

    await page.locator('input[name="name"]').fill("Form Tester");
    await page.getByRole("button", { name: "Broker" }).click();
    await page.locator('input[name="phone"]').fill("123");
    await page.locator('input[name="email"]').fill("not-an-email");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText("Enter a valid phone number")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();

    await page.locator('input[name="phone"]').fill("0300 1234567");
    await page.locator('input[name="email"]').fill("tester@example.com");
    await page.locator('input[name="company"]').fill("Tester Estates");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page).toHaveURL(/\/dashboard\/contacts$/);
    const row = page.locator("tbody tr", { hasText: "Form Tester" });
    await expect(row).toContainText("Tester Estates");
    await expect(row).toContainText("Mandate unverified"); // a new broker has not been checked
  });

  test("editing changes the details and the phone links update", async ({ page, request }) => {
    const c = await contact(request, { name: "Edit Me", phone: "0300 1111111" });
    await page.goto(`/dashboard/contacts/${c.id}/edit`);
    await page.locator('input[name="phone"]').fill("0321 7654321");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/contacts/${c.id}$`));
    await expect(page.getByRole("link", { name: "0321 7654321" })).toHaveAttribute("href", "tel:03217654321");
    await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/923217654321"); // 0321 becomes 92 321
  });

  test("a broker's mandate can be marked verified and unverified", async ({ page, request }) => {
    const c = await contact(request, { name: "Mandate Broker" });
    await page.goto(`/dashboard/contacts/${c.id}`);
    await expect(page.getByText("Mandate unverified")).toBeVisible();
    await page.getByRole("button", { name: "Mark mandate verified" }).click();
    await expect(page.getByText("Mandate verified", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mark unverified" }).click();
    await expect(page.getByText("Mandate unverified")).toBeVisible();
  });
});

test.describe("Contact log and follow-ups", () => {
  test("logging needs a summary; a follow-up shows on the contacts page until it is done", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "LOG-1" });
    const c = await contact(request, { name: "Follow Up Person" });
    await page.goto(`/dashboard/contacts/${c.id}`);
    await expect(page.getByText(/Nothing logged yet/)).toBeVisible();

    await page.getByRole("button", { name: "+ Log contact" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Write what was discussed")).toBeVisible();

    await page.locator('textarea[name="summary"]').fill("Asked about the corner plot");
    await page.getByRole("combobox", { name: "Plot" }).click();
    await page.getByRole("option", { name: /LOG-1/ }).click();
    await page.locator('input[name="followup_on"]').fill(today());
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Asked about the corner plot")).toBeVisible();
    await expect(page.getByRole("link", { name: /LOG-1/ })).toHaveAttribute("href", `/dashboard/plots/${p.id}`);

    await page.goto("/dashboard/contacts"); // the follow-up appears here
    const follow = page.locator("section", { has: page.getByRole("heading", { name: "Follow-ups" }) });
    await expect(follow).toContainText("Follow Up Person");
    await follow.locator("li", { hasText: "Follow Up Person" }).getByRole("button", { name: "Done" }).click();
    await expect(follow.locator("li", { hasText: "Follow Up Person" })).toHaveCount(0);

    await page.goto(`/dashboard/contacts/${c.id}`);
    await expect(page.getByText("Follow-up done")).toBeVisible();
  });

  test("a follow-up date in the past is refused", async ({ page, request }) => {
    const c = await contact(request, { name: "Past Date" });
    await page.goto(`/dashboard/contacts/${c.id}`);
    await page.getByRole("button", { name: "+ Log contact" }).click();
    await page.locator('textarea[name="summary"]').fill("Something");
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA");
    await page.locator('input[name="followup_on"]').evaluate((el: HTMLInputElement, v) => { el.removeAttribute("min"); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, yesterday);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Pick today or a later date")).toBeVisible();
  });

  test("quotes are matched to a contact by the broker's name", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "MATCH-1" });
    const c = await contact(request, { name: "Matched Broker" });
    await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker: "matched broker", quote_type: "asking", price_pkr: 123_000_000, inclusions: "" } });
    await page.goto(`/dashboard/contacts/${c.id}`);
    await expect(page.getByText("PKR 123,000,000")).toBeVisible();
  });
});

test.describe("Contacts list", () => {
  test("search and role tabs narrow the list", async ({ page, request }) => {
    await contact(request, { name: "Zed Broker", company: "Zedcorp Holdings", roles: ["broker"] });
    await contact(request, { name: "Zed Owner", roles: ["owner"] });
    await contact(request, { name: "Zed Architect", roles: ["architect"] });
    await page.goto("/dashboard/contacts");
    await page.getByPlaceholder("Search name, company, phone").fill("Zed");
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await page.getByRole("button", { name: "Owner", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr")).toContainText("Zed Owner");
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByPlaceholder("Search name, company, phone").fill("zedcorp"); // company counts too
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByPlaceholder("Search name, company, phone").fill("nobody-here");
    await expect(page.getByText("No contacts match.")).toBeVisible();
  });

  test("archiving removes a contact from the list", async ({ page, request }) => {
    const c = await contact(request, { name: "Archive Me" });
    await page.goto(`/dashboard/contacts/${c.id}`);
    await page.getByRole("button", { name: "Archive contact" }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/contacts$/);
    await expect(page.locator("tbody tr", { hasText: "Archive Me" })).toHaveCount(0);
  });
});
