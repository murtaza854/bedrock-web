import { API, expect, test } from "./fixtures";

const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString("en-CA"); };

async function negotiation(request: any, plotId: number, data: Record<string, unknown> = {}) {
  const r = await request.post(`${API}/plots/${plotId}/negotiations`, { data: { counterparty: "Mr Seller", side: "theirs", amount_pkr: 700_000_000, made_on: day(), terms: "", ...data } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

test.describe("Starting a negotiation", () => {
  test("needs a counterparty and an amount, then opens the negotiation", async ({ page, plot }) => {
    const p = await plot({ plot_no: "OFF-NEW" });
    await page.goto(`/dashboard/offers/new?plot=${p.id}`);
    await page.getByRole("button", { name: "Start negotiation" }).click();
    await expect(page.getByText("Who are you negotiating with?")).toBeVisible();
    await expect(page.getByText("Enter an amount above zero")).toBeVisible();

    await page.getByPlaceholder("Broker or owner").fill("Mr Seller");
    await page.locator('input[name="amount_pkr"]').fill("700000000");
    await page.locator('input[name="valid_until"]').fill(day(-3)); // before the date it was made
    await page.getByRole("button", { name: "Start negotiation" }).click();
    await expect(page.getByText("Must be on or after the date made")).toBeVisible();

    await page.locator('input[name="valid_until"]').fill("");
    await page.getByRole("button", { name: "Start negotiation" }).click();
    await expect(page).toHaveURL(/\/dashboard\/offers\/\d+$/);
    await expect(page.getByText("Negotiating with Mr Seller")).toBeVisible();
    await expect(page.getByText("PKR 700,000,000").first()).toBeVisible();
    await expect(page.getByText("Your move")).toBeVisible(); // they named a price, so the next move is ours
  });
});

test.describe("A negotiation", () => {
  test("rounds move the turn, show the gap and chart, and a round can be voided with a reason", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "OFF-R" });
    const n = await negotiation(request, p.id);
    await page.goto(`/dashboard/offers/${n.id}`);

    await page.getByRole("button", { name: "+ Add a round" }).click();
    await page.getByRole("button", { name: "Save round" }).click();
    await expect(page.getByText("Enter an amount above zero")).toBeVisible();
    await page.locator('input[name="amount_pkr"]').fill("600000000"); // the side defaults to our offer, since they spoke last
    await page.getByRole("button", { name: "Save round" }).click();

    await expect(page.getByText("Waiting on them").first()).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByText("100,000,000").first()).toBeVisible(); // the gap: 700m against 600m
    await expect(page.getByRole("img", { name: /Offer amounts by round/ })).toBeVisible();

    await page.locator("tbody tr").last().getByRole("button", { name: "Void" }).click();
    await page.locator("form").getByRole("button", { name: "Void" }).click(); // no reason yet
    await expect(page.getByText("Say why")).toBeVisible();
    await page.getByPlaceholder("Reason").fill("Typed the wrong amount");
    await page.locator("form").getByRole("button", { name: "Void" }).click();
    await expect(page.getByText("Voided:")).toBeVisible();
    await expect(page.getByText("Your move")).toBeVisible(); // the voided round no longer counts
  });

  test("an offer past its valid-until date shows as lapsed", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "OFF-L" });
    const n = await negotiation(request, p.id, { side: "ours", amount_pkr: 600_000_000, made_on: day(-10), valid_until: day(-5) });
    await page.goto(`/dashboard/offers/${n.id}`);
    await expect(page.getByText("Offer lapsed")).toBeVisible();
    await expect(page.getByText("Lapsed", { exact: true })).toBeVisible();
  });

  test("closing as accepted needs a price, links to recording the purchase, and can be reopened", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "OFF-C" });
    const n = await negotiation(request, p.id);
    await page.goto(`/dashboard/offers/${n.id}`);
    await page.getByRole("button", { name: "Close negotiation" }).click();
    await page.locator('input[name="agreed_pkr"]').fill("");
    await page.getByRole("button", { name: "Close negotiation" }).last().click();
    await expect(page.getByText("Enter the agreed price")).toBeVisible();
    await page.locator('input[name="agreed_pkr"]').fill("650000000");
    await page.getByRole("button", { name: "Close negotiation" }).last().click();

    await expect(page.getByText("Accepted at PKR 650,000,000").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Record the purchase" })).toHaveAttribute("href", `/dashboard/plots/${p.id}?buy=1`);

    await page.getByRole("button", { name: "Reopen" }).click();
    await expect(page.getByRole("button", { name: "+ Add a round" })).toBeVisible();
  });

  test("the accepted-offer link opens the purchase form with the agreed price", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "OFF-P" });
    const n = await negotiation(request, p.id, { counterparty: "Agreed Seller" });
    await request.post(`${API}/negotiations/${n.id}/close`, { data: { status: "accepted", agreed_pkr: 640_000_000, note: "" } });
    await page.goto(`/dashboard/plots/${p.id}?buy=1`);
    await expect(page.getByRole("heading", { name: "Record the purchase" })).toBeVisible();
    await expect(page.locator('dialog input[name="price_pkr"]')).toHaveValue("640000000");
    await expect(page.locator('dialog input[name="seller"]')).toHaveValue("Agreed Seller");
  });
});

test.describe("Offers list", () => {
  test("tabs separate open from closed negotiations", async ({ page, plot, request }) => {
    const open = await plot({ plot_no: "OFFLIST-OPEN" });
    const closed = await plot({ plot_no: "OFFLIST-DONE" });
    await negotiation(request, open.id, { counterparty: "Open Person" });
    const n = await negotiation(request, closed.id, { counterparty: "Done Person" });
    await request.post(`${API}/negotiations/${n.id}/close`, { data: { status: "rejected", agreed_pkr: null, note: "" } });

    await page.goto("/dashboard/offers");
    await expect(page.locator("tbody tr", { hasText: "Open Person" })).toBeVisible();
    await expect(page.locator("tbody tr", { hasText: "Done Person" })).toHaveCount(0);
    await page.getByRole("button", { name: "Closed" }).click();
    await expect(page.locator("tbody tr", { hasText: "Done Person" })).toBeVisible();
    await expect(page.locator("tbody tr", { hasText: "Open Person" })).toHaveCount(0);
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.locator("tbody tr", { hasText: "Open Person" })).toBeVisible();
    await expect(page.locator("tbody tr", { hasText: "Done Person" })).toBeVisible();
  });

  test("the plot page lists its negotiations", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "OFF-SUM" });
    await negotiation(request, p.id, { counterparty: "Summary Person" });
    await page.goto(`/dashboard/plots/${p.id}`);
    await expect(page.getByText("Summary Person")).toBeVisible();
  });
});
