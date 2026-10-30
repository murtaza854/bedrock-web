import { API, expect, test } from "./fixtures";

const rowOf = (page: any, text: string) => page.locator("tbody tr", { hasText: text });

test.describe("Plots list", () => {
  test("search, status tabs and the area filter narrow the list", async ({ page, plot, request }) => {
    const a = await plot({ area: "DHA Phase 6", plot_no: "PLTL-A", street: "Khayaban-e-Bukhari" });
    await plot({ area: "Bahadurabad", plot_no: "PLTL-B" });
    await plot({ area: "Bahadurabad", plot_no: "PLTL-C" });
    await request.patch(`${API}/plots/${a.id}`, { data: { status: "shortlisted" } });

    await page.goto("/dashboard/plots");
    const search = page.getByPlaceholder("Search plot, sector, street");
    await search.fill("PLTL-");
    await expect(page.locator("tbody tr")).toHaveCount(3);

    await search.fill("bukhari"); // street counts too
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr")).toContainText("PLTL-A");

    await search.fill("PLTL-");
    await page.getByRole("button", { name: /^shortlisted/ }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("button", { name: /^all/ }).click();

    await page.getByRole("combobox", { name: "Area" }).click();
    await page.getByRole("option", { name: "Bahadurabad" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(2);

    await search.fill("no-such-plot");
    await expect(page.getByText("No plots match these filters.")).toBeVisible();
  });

  test("clicking a column heading sorts, and sorting again reverses", async ({ page, plot }) => {
    await plot({ area: "Sortville", plot_no: "S1", size_sqyd: 500 });
    await plot({ area: "Sortville", plot_no: "S2", size_sqyd: 200 });
    await plot({ area: "Sortville", plot_no: "S3", size_sqyd: 350 });
    await page.goto("/dashboard/plots");
    await page.getByPlaceholder("Search plot, sector, street").fill("Sortville");
    await page.getByRole("button", { name: "Size", exact: true }).click();
    await expect(page.locator("tbody tr").first()).toContainText("200 sq yd");
    await page.getByRole("button", { name: /^Size/ }).click();
    await expect(page.locator("tbody tr").first()).toContainText("500 sq yd");
  });

  test("changing a status from the list saves it", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "ST-1" });
    await page.goto("/dashboard/plots");
    await page.getByPlaceholder("Search plot, sector, street").fill("ST-1");
    await page.getByRole("combobox", { name: /^Status of/ }).click();
    await page.getByRole("option", { name: "Negotiating" }).click();
    await expect.poll(async () => (await (await request.get(`${API}/plots/${p.id}`)).json()).plot.status).toBe("negotiating");
  });
});

test.describe("Plot page", () => {
  test("rejecting needs a reason, and the reason lands in the history", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "REJ-1" });
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Rejected" }).click();
    await page.getByRole("button", { name: "Reject plot" }).click();
    await expect(page.getByText("Say why this plot is being rejected")).toBeVisible();
    await page.getByPlaceholder("Reason").fill("Title is disputed");
    await page.getByRole("button", { name: "Reject plot" }).click();
    await expect(page.getByText("Title is disputed")).toBeVisible();
    expect((await (await request.get(`${API}/plots/${p.id}`)).json()).plot.status).toBe("rejected");
  });

  test("a purchase needs a price, makes the plot bought, locks the status, and can be voided", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "BUY-1" });
    await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker: "Asif", quote_type: "asking", price_pkr: 700_000_000, inclusions: "" } });
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Bought" }).click();

    const price = page.locator('dialog input[name="price_pkr"]');
    await price.fill("");
    await page.getByRole("button", { name: "Record purchase" }).click();
    await expect(page.getByText("Enter the price you paid")).toBeVisible();
    await price.fill("650000000");
    await page.locator('dialog input[name="seller"]').fill("Mr Owner");
    await page.getByRole("button", { name: "Record purchase" }).click();

    const purchase = page.locator("section", { has: page.getByRole("heading", { name: "Purchase" }) });
    await expect(purchase).toContainText("PKR 650,000,000");
    await expect(purchase).toContainText("from Mr Owner");
    await expect(purchase).toContainText("below"); // compared with the 700m asking price
    expect((await (await request.get(`${API}/plots/${p.id}`)).json()).plot.status).toBe("bought");

    await page.getByRole("combobox", { name: "Status" }).click(); // a bought plot cannot simply be set back
    await page.getByRole("option", { name: "Shortlisted" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "was bought" })).toBeVisible();

    await page.getByRole("button", { name: /Void this purchase/ }).click();
    await page.getByPlaceholder("Why is this being voided?").fill("Entered by mistake");
    await page.getByRole("button", { name: "Void purchase" }).click();
    await expect(purchase).toHaveCount(0);
  });

  test("quotes: errors, the strongest quote sets the price, and disagreeing brokers are flagged", async ({ page, plot }) => {
    const p = await plot({ plot_no: "Q-1", size_sqyd: 400 });
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.getByRole("button", { name: "+ Add quote" }).click();
    await page.getByRole("button", { name: "Save quote" }).click();
    await expect(page.getByText("Enter the broker")).toBeVisible();
    await expect(page.getByText("Enter a price")).toBeVisible();

    const add = async (broker: string, type: string, price: string) => {
      if (!(await page.getByPlaceholder("Broker").isVisible())) await page.getByRole("button", { name: "+ Add quote" }).click();
      await page.getByPlaceholder("Broker").fill(broker);
      await page.getByRole("combobox", { name: "Quote type" }).click();
      await page.getByRole("option", { name: type, exact: true }).click();
      await page.getByPlaceholder("Price (PKR)").fill(price);
      await page.getByRole("button", { name: "Save quote" }).click();
      await expect(page.locator("tbody tr", { hasText: broker })).toBeVisible();
    };
    await add("Bilal", "Asking", "700000000");
    await add("Chaudhry", "Owner confirmed", "560000000");
    await expect(page.getByText("Computed from the strongest quote type")).toContainText("Owner confirmed");
    await expect(page.getByText(/Brokers differ by 25%/)).toBeVisible(); // 560m to 700m
    await expect(page.locator("tbody tr")).toHaveCount(2);
  });

  test("facts: a second value at the same level shows as a conflict", async ({ page, plot }) => {
    const p = await plot({ plot_no: "C-1" });
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.getByRole("button", { name: "+ Add claim" }).click();
    await page.getByRole("button", { name: "Save claim" }).click();
    await expect(page.getByText("Enter a field")).toBeVisible();
    for (const value of ["yes", "no"]) {
      if (!(await page.getByPlaceholder("Value").isVisible())) await page.getByRole("button", { name: "+ Add claim" }).click();
      await page.getByPlaceholder(/Field/).fill("corner");
      await page.getByPlaceholder("Value").fill(value);
      await page.getByPlaceholder("Source").fill("broker");
      await page.getByRole("button", { name: "Save claim" }).click();
      await expect(page.getByPlaceholder("Value")).toBeHidden(); // the form closes once the claim is saved
    }
    await expect(page.getByText("Conflict")).toBeVisible();
  });

  test("the report page opens for a plot", async ({ page, plot }) => {
    const p = await plot({ plot_no: "REP-1" });
    await page.goto(`/dashboard/plots/${p.id}/report`);
    await expect(page.getByText("REP-1").first()).toBeVisible();
    await expect(page.getByText(/not legal advice/)).toBeVisible();
  });
});

// The purchase form suggests a price (and a seller, if an offer was accepted) a moment after it opens. Slowing that
// answer down makes the race happen every time: you start typing, then the suggestion arrives.
const slowNegotiations = (page: any, ms = 1500) => page.route("**/negotiations", async (route: any) => {
  if (route.request().method() !== "GET") return route.continue();
  const response = await route.fetch();
  await new Promise((r) => setTimeout(r, ms));
  await route.fulfill({ response });
});

test.describe("Purchase form: the suggestion never overwrites what you typed", () => {
  test("a price typed before the suggestion arrives is kept", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "PF-TYPED" });
    await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker: "Asif", quote_type: "asking", price_pkr: 700_000_000, inclusions: "" } });
    await slowNegotiations(page);
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Bought" }).click();
    const price = page.locator('dialog input[name="price_pkr"]');
    await expect(price).toHaveValue(""); // nothing suggested yet
    await price.fill("650000000");
    await page.locator('dialog input[name="seller"]').fill("Typed Seller");
    await expect(page.getByText(/Starting from the plot's current price/)).toBeVisible(); // the suggestion has now arrived
    await expect(price).toHaveValue("650,000,000");
    await expect(page.locator('dialog input[name="seller"]')).toHaveValue("Typed Seller");
    await page.getByRole("button", { name: "Record purchase" }).click();
    await expect(page.locator("section", { has: page.getByRole("heading", { name: "Purchase" }) })).toContainText("PKR 650,000,000");
  });

  test("a field you have not touched still gets the suggestion", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "PF-MIX" });
    const n = await (await request.post(`${API}/plots/${p.id}/negotiations`, { data: { counterparty: "Agreed Seller", side: "theirs", amount_pkr: 700_000_000, made_on: new Date().toLocaleDateString("en-CA"), terms: "" } })).json();
    await request.post(`${API}/negotiations/${n.id}/close`, { data: { status: "accepted", agreed_pkr: 640_000_000, note: "" } });
    await slowNegotiations(page);
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Bought" }).click();
    await page.locator('dialog input[name="price_pkr"]').fill("655000000"); // typed price, untouched seller
    await expect(page.getByText(/price you agreed in your accepted offer/)).toBeVisible();
    await expect(page.locator('dialog input[name="price_pkr"]')).toHaveValue("655,000,000"); // mine
    await expect(page.locator('dialog input[name="seller"]')).toHaveValue("Agreed Seller"); // suggested
  });

  test("clearing a suggested price and leaving it empty is respected, not refilled", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "PF-CLEAR" });
    await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker: "Asif", quote_type: "asking", price_pkr: 700_000_000, inclusions: "" } });
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Bought" }).click();
    const price = page.locator('dialog input[name="price_pkr"]');
    await expect(price).toHaveValue("700,000,000"); // suggested from the plot's price
    await price.fill("");
    await page.getByRole("button", { name: "Record purchase" }).click();
    await expect(page.getByText("Enter the price you paid")).toBeVisible();
    await expect(price).toHaveValue("");
  });

  test("opening it for another plot starts clean, with no price left over from the last one", async ({ page, plot, request }) => {
    const priced = await plot({ plot_no: "PF-PRICED" });
    await plot({ plot_no: "PF-BARE" });
    await request.post(`${API}/plots/${priced.id}/quotes`, { data: { broker: "Asif", quote_type: "asking", price_pkr: 700_000_000, inclusions: "" } });
    await page.goto("/dashboard/plots");
    await page.getByPlaceholder("Search plot, sector, street").fill("PF-");
    const status = (no: string) => page.locator("tbody tr", { hasText: no }).getByRole("combobox", { name: /^Status of/ });
    await status("PF-PRICED").click();
    await page.getByRole("option", { name: "Bought" }).click();
    await expect(page.locator('dialog input[name="price_pkr"]')).toHaveValue("700,000,000");
    await page.getByRole("button", { name: "Cancel" }).click();
    await status("PF-BARE").click();
    await page.getByRole("option", { name: "Bought" }).click();
    await expect(page.locator('dialog input[name="price_pkr"]')).toHaveValue("");
    await expect(page.getByText(/Starting from/)).toHaveCount(0);
  });
});

