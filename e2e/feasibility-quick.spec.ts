import { API, bought, expect, test } from "./fixtures";

test.describe("Quick feasibility", () => {
  test("steps through areas and prices to a profit percentage, and saves one scenario per land price", async ({ page, plot, request }) => {
    const p = await plot({ area: "Quick Feas Town", size_sqyd: 200 });
    await page.goto(`/dashboard/plots/${p.id}/feasibility`);
    await expect(page.getByRole("progressbar", { name: "Step 1 of 7" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // Buildings: one building, the default
    await expect(page.getByLabel("Ground floor (sq ft)")).toHaveValue(""); // the projection sits beside the field, not in it
    await expect(page.getByPlaceholder("e.g. 120,000")).toBeVisible(); // hints get the commas too
    await expect(page.getByText("Suggested: 1,620 sq ft")).toBeVisible(); // 90% of 1,800 sq ft
    await page.getByRole("button", { name: "Use this" }).click();
    await expect(page.getByLabel("Ground floor (sq ft)")).toHaveValue("1,620");
    await page.getByLabel("Ground floor (sq ft)").fill("1650");
    await page.getByLabel("Sale price per sq ft (PKR)").fill("120000");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Area of each floor (sq ft)")).toHaveValue("");
    await expect(page.getByText("Suggested: 1,650 sq ft")).toBeVisible(); // the ground floor typed in step 1
    await page.getByLabel("Number of floors above ground").fill("4");
    await page.getByLabel("Area of each floor (sq ft)").fill("2040");
    await page.getByLabel("Sale price per sq ft (PKR), offices").fill("30000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Number of basement floors").fill("1");
    await page.getByLabel("Area of each basement floor (sq ft)").fill("1800");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Construction cost per sq ft (PKR), same for every floor").fill("7000");
    await page.getByLabel("Land price in PKR").fill("300000000");
    await page.getByRole("button", { name: "Add another land price" }).click();
    await page.getByLabel("Land price in PKR").nth(1).fill("280000000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Years").fill("2");
    await page.getByLabel("Months").fill("6");
    await page.getByRole("button", { name: "Work it out" }).click();

    await expect(page.getByRole("row", { name: /^Monthly profit/ })).toContainText("2,051,000"); // 61,530,000 over 30 months
    await expect(page.getByRole("row", { name: /^Annual profit/ })).toContainText("24,612,000");
    await expect(page.getByText("2 years 6 months = 30 months")).toBeVisible();
    await expect(page.getByText("1,650 sq ft × 120,000 = 198,000,000")).toBeVisible(); // what was entered, with the working
    await expect(page.getByText("4 × 2,040 = 8,160 sq ft × 30,000 = 244,800,000")).toBeVisible();
    await expect(page.getByText("1,650 + 8,160 + 1,800 = 11,610 sq ft × 7,000 construction = 81,270,000")).toBeVisible();
    const profit = page.getByRole("row", { name: /^Profit on cost/ });
    await expect(page.getByRole("row", { name: /^Revenue/ })).toContainText("442,800,000");
    await expect(page.getByRole("row", { name: /^Total cost/ })).toContainText("381,270,000"); // 30 + 11,610 sq ft x 7,000
    await expect(page.getByRole("row", { name: /^Profit / }).first()).toContainText("61,530,000");
    await expect(profit).toContainText("16.14%");
    await expect(profit).toContainText("%"); // and a second column for the second land price

    await page.getByRole("button", { name: "Save as scenarios" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots\/\d+$/); // saving goes back to the plot
    const models = await (await request.get(`${API}/plots/${p.id}/financial-models`)).json();
    expect(models.map((m: any) => m.model.name).sort()).toEqual(["Demand", "Scenario 2"]);
    expect(models.find((m: any) => m.model.name === "Demand").output.profit).toBe(61_530_000);
    await page.goto(`/dashboard/plots/${p.id}`); // and the saved scenario can be opened from the plot page
    const demand = page.locator("li", { has: page.locator("summary", { hasText: "Demand" }) });
    await demand.locator("summary").click();
    await expect(demand.getByRole("row", { name: /^Ground 1,650 120,000/ })).toContainText("198,000,000"); // a table, one row per floor
    await expect(demand.getByRole("row", { name: /^Construction 11,610 7,000/ })).toContainText("81,270,000");
    await expect(demand.getByRole("row", { name: /^Monthly profit/ })).toContainText("2,051,000"); // construction time was saved too

    const second = page.locator("li", { has: page.locator("summary", { hasText: "Scenario 2" }) });
    await expect(second.locator("summary")).toContainText("primary"); // the newest scenario is the primary one
    await demand.getByRole("button", { name: "Make primary" }).click(); // and the star can be moved
    await expect(demand.locator("summary")).toContainText("primary");
    await second.locator("summary").click();
    await second.getByRole("button", { name: "Delete" }).click(); // deleting asks first, in a dialog
    await expect(page.getByRole("dialog").getByText("Delete Scenario 2?")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(second).toHaveCount(1);
    await second.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete scenario" }).click();
    await expect(second).toHaveCount(0);

    await demand.getByRole("link", { name: "Edit this scenario" }).click(); // editing: the wizard opens with the saved answers
    await expect(page.getByText("Editing the scenario")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // past Buildings
    await expect(page.getByLabel("Ground floor (sq ft)")).toHaveValue("1,650");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Land price in PKR").fill("290000000");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Years")).toHaveValue("2");
    await page.getByRole("button", { name: "Work it out" }).click();
    await expect(page.getByRole("row", { name: /^Profit / }).first()).toContainText("71,530,000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots\/\d+$/); // saving goes back to the plot
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.locator("summary", { hasText: "Demand" }).click();
    await expect(page.locator("li", { has: page.locator("summary", { hasText: "Demand" }) }).getByRole("row", { name: /^Profit / })).toContainText("71,530,000");

    await page.goto("/dashboard/plots"); // and the plot list shows the primary scenario's profit on cost
    await page.getByPlaceholder("Search plot, sector, street").fill(p.plot_no);
    await expect(page.getByRole("row", { name: new RegExp(p.plot_no) })).toContainText("19.27%"); // 71,530,000 over 371,270,000
    await expect(page.getByRole("row", { name: new RegExp(p.plot_no) })).toContainText("Demand");
  });

  test("no basement and no upper floors: leave them blank and the cost is land plus the ground floor only", async ({ page, plot }) => {
    const p = await plot({ area: "Quick Feas Town", size_sqyd: 200 });
    await page.goto(`/dashboard/plots/${p.id}/feasibility`);
    await page.getByRole("button", { name: "Next" }).click(); // Buildings: one building, the default
    await page.getByLabel("Ground floor (sq ft)").fill("1000");
    await page.getByLabel("Sale price per sq ft (PKR)").fill("100000");
    await page.getByLabel("Sale price per sq ft (PKR)").press("Enter"); // the same as clicking Next
    await expect(page.getByRole("heading", { name: "Upper floors" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // no upper floors
    await page.getByRole("button", { name: "No basement" }).click();
    await page.getByLabel("Construction cost per sq ft (PKR), same for every floor").fill("5000");
    await page.getByLabel("Land price in PKR").fill("50000000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Years").fill("2");
    await page.getByLabel("Months").fill("6");
    await page.getByRole("button", { name: "Work it out" }).click();
    await expect(page.getByRole("row", { name: /^Revenue/ })).toContainText("100,000,000");
    await expect(page.getByRole("row", { name: /^Total cost/ })).toContainText("55,000,000"); // 5 land + 1,000 sq ft x 5,000
    await expect(page.getByRole("row", { name: /^Profit / }).first()).toContainText("45,000,000");
  });

  test("several basement floors and apartments above: every basement floor is built, only the apartments are sold", async ({ page, plot }) => {
    const p = await plot({ area: "Quick Feas Town", size_sqyd: 200 });
    await page.goto(`/dashboard/plots/${p.id}/feasibility`);
    await page.getByRole("button", { name: "Next" }).click(); // Buildings: one building, the default
    await page.getByLabel("Ground floor (sq ft)").fill("1000");
    await page.getByLabel("Sale price per sq ft (PKR)").fill("100000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Number of floors above ground").fill("2");
    await page.getByLabel("Area of each floor (sq ft)").fill("1000");
    await page.getByRole("combobox", { name: "Sold as" }).click();
    await page.getByRole("option", { name: "Apartments" }).click();
    await page.getByLabel("Sale price per sq ft (PKR), apartments").fill("32000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Number of basement floors").fill("3"); // parking
    await page.getByLabel("Area of each basement floor (sq ft)").fill("1000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Construction cost per sq ft (PKR), same for every floor").fill("6000");
    await page.getByLabel("Land price in PKR").fill("50000000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Years").fill("2");
    await page.getByLabel("Months").fill("6");
    await page.getByRole("button", { name: "Work it out" }).click();
    await expect(page.getByRole("row", { name: /^Revenue/ })).toContainText("164,000,000"); // 1,000 x 100,000 + 2,000 x 32,000
    await expect(page.getByRole("row", { name: /^Total cost/ })).toContainText("86,000,000"); // 5 land + 6,000 sq ft (ground, two floors, three basements) x 6,000
  });

  test("the detailed model is closed until the plot is bought, then opens", async ({ page, plot, request }) => {
    const p = await plot({ area: "Quick Feas Town", size_sqyd: 200 });
    await page.goto(`/dashboard/plots/${p.id}/financials`);
    await expect(page.getByRole("heading", { name: "Available once the plot is bought" })).toBeVisible();
    await bought(request, p.id);
    await page.goto(`/dashboard/plots/${p.id}/financials`);
    await expect(page.getByRole("heading", { name: "Financial feasibility" })).toBeVisible();
  });

  test("two buildings each get their own answers and result, plus a combined view", async ({ page, plot }) => {
    const joined = await plot({ area: "Quick Feas Town", size_sqyd: 400, plot_no: `T${Date.now()} & T2` }); // two plots, like 167 & 169
    await page.goto(`/dashboard/plots/${joined.id}/feasibility`);
    await expect(page.getByText("Needs amalgamation of the two plots.")).toBeVisible(); // one building on two plots, the default
    await page.getByRole("combobox", { name: "Buildings" }).click();
    await page.getByRole("option", { name: "Two buildings, each on half the plot" }).click();
    await expect(page.getByText("No amalgamation or bifurcation needed")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { name: "Building 1: Ground floor" })).toBeVisible();
    await expect(page.getByText("Suggested: 1,620 sq ft (90% of half the plot)")).toBeVisible(); // 400 sq yd / 2 = 200 sq yd = 1,800 sq ft
    await page.getByLabel("Ground floor (sq ft)").fill("1000");
    await page.getByLabel("Sale price per sq ft (PKR)").fill("100000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click(); // no upper floors
    await page.getByRole("button", { name: "No basement" }).click();

    await expect(page.getByRole("heading", { name: "Building 2: Ground floor" })).toBeVisible();
    await page.getByRole("button", { name: "Copy everything from Building 1" }).click();
    await expect(page.getByLabel("Ground floor (sq ft)")).toHaveValue("1,000");
    await page.getByLabel("Sale price per sq ft (PKR)").fill("80000"); // building 2 sells for less
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "No basement" }).click();
    await page.getByLabel("Construction cost per sq ft (PKR), same for every floor").fill("5000");
    await page.getByLabel("Land price in PKR").fill("50000000"); // one price for all the land
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Years").fill("1");
    await page.getByRole("button", { name: "Work it out" }).click();

    const row = (name: RegExp) => page.getByRole("row", { name });
    await expect(row(/^Revenue/)).toContainText("180,000,000"); // combined is the default view: 100M + 80M
    await expect(row(/^Total cost/)).toContainText("60,000,000"); // 50M land + 2,000 sq ft x 5,000
    await expect(row(/^Profit /).first()).toContainText("120,000,000");
    await page.getByRole("button", { name: "Building 1", exact: true }).click();
    await expect(row(/^Revenue/)).toContainText("100,000,000");
    await expect(row(/^Land/)).toContainText("25,000,000"); // each building gets half the land
    await expect(row(/^Profit /).first()).toContainText("70,000,000");
    await page.getByRole("button", { name: "Building 2", exact: true }).click();
    await expect(row(/^Profit /).first()).toContainText("50,000,000");

    await page.getByRole("button", { name: "Save as a scenario" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots\/\d+$/); // saving goes back to the plot
    await page.goto(`/dashboard/plots/${joined.id}`); // the plot page has the same three views
    const demand = page.locator("li", { has: page.locator("summary", { hasText: "Demand" }) });
    await demand.locator("summary").click();
    await demand.getByRole("button", { name: "Building 2", exact: true }).click();
    await expect(demand.getByRole("row", { name: /^Revenue/ })).toContainText("80,000,000");
    await expect(demand.getByRole("row", { name: /^Land/ })).toContainText("25,000,000");
    await demand.getByRole("button", { name: "Combined" }).click();
    await expect(demand.getByRole("row", { name: /^Revenue/ })).toContainText("180,000,000");

    await demand.getByRole("link", { name: "Edit this scenario" }).click(); // reopened for editing, each building keeps its own answers
    await expect(page.getByRole("combobox", { name: "Buildings" })).toContainText("Two buildings");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next" }).click(); // Buildings, then Building 1's ground and upper floors
    await page.getByRole("button", { name: "No basement" }).click(); // to Building 2's ground floor
    await expect(page.getByLabel("Sale price per sq ft (PKR)")).toHaveValue("80,000");

    const single = await plot({ area: "Quick Feas Town", size_sqyd: 400 }); // one plot split in two
    await page.goto(`/dashboard/plots/${single.id}/feasibility`);
    await page.getByRole("combobox", { name: "Buildings" }).click();
    await page.getByRole("option", { name: "Two buildings, each on half the plot" }).click();
    await expect(page.getByText("Needs bifurcation of the plot.")).toBeVisible();
  });

  test("floor groups and sellable shares: a report's floors go in as they are, and survive saving and editing", async ({ page, plot }) => {
    const p = await plot({ area: "Report Town", size_sqyd: 516 });
    await page.goto(`/dashboard/plots/${p.id}/feasibility`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Ground floor (sq ft)").fill("3086"); // banking hall: 85% sellable at 250,000
    await page.getByLabel("Sale price per sq ft (PKR)").fill("250000");
    await page.getByLabel("Sellable share (%)").fill("85");
    await page.getByRole("button", { name: "Next" }).click();

    const L = (base: string, g: number) => (g === 1 ? base : `${base}, group ${g}`);
    const group = async (g: number, name: string, count: string, area: string) => {
      await page.getByLabel(L("Group name", g), { exact: true }).fill(name);
      await page.getByLabel(L("Number of floors above ground", g), { exact: true }).fill(count);
      await page.getByLabel(L("Area of each floor (sq ft)", g), { exact: true }).fill(area);
      await page.getByLabel(L("Sellable share (%)", g), { exact: true }).fill("75");
      await page.getByLabel(g === 1 ? "Sale price per sq ft (PKR), offices" : `Sale price per sq ft (PKR), offices, group ${g}`, { exact: true }).fill("45000");
    };
    await group(1, "Mezzanine", "1", "3086");
    await page.getByRole("button", { name: "Add another group of floors" }).click();
    await group(2, "Floors 1 to 2", "2", "3811");
    await page.getByRole("button", { name: "Add another group of floors" }).click();
    await group(3, "Floors 3 to 11", "9", "3066");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "No basement" }).click();
    await page.getByLabel("Construction cost per sq ft (PKR), same for every floor").fill("10000");
    await page.getByLabel("Land price in PKR").fill("1000000000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Years").fill("3");
    await page.getByRole("button", { name: "Work it out" }).click();

    // 655,775,000 ground + 104,152,500 mezzanine + 257,242,500 floors 1-2 + 931,297,500 floors 3-11
    await expect(page.getByRole("row", { name: /^Revenue/ })).toContainText("1,948,467,500");
    await expect(page.getByText("3,086 sq ft × 85% sellable = 2,623.1 sq ft × 250,000 = 655,775,000")).toBeVisible();
    await expect(page.getByText("9 × 3,066 = 27,594 sq ft × 75% sellable = 20,695.5 sq ft × 45,000 = 931,297,500")).toBeVisible();
    await expect(page.getByText("3,086 + 38,302 = 41,388 sq ft × 10,000 construction = 413,880,000")).toBeVisible(); // construction counts the whole covered area, sold or not
    await page.getByRole("button", { name: "Save as a scenario" }).click();
    await expect(page).toHaveURL(/\/dashboard\/plots\/\d+$/);

    const scenario = page.locator("li", { has: page.locator("summary", { hasText: "Demand" }) });
    await scenario.locator("summary").click();
    await expect(scenario.getByRole("row", { name: /^Revenue/ })).toContainText("1,948,467,500");
    await scenario.getByRole("link", { name: "Edit this scenario" }).click(); // the groups come back as they were entered
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Sellable share (%)")).toHaveValue("85");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Group name", { exact: true })).toHaveValue("Mezzanine");
    await expect(page.getByLabel("Group name, group 2")).toHaveValue("Floors 1 to 2");
    await expect(page.getByLabel("Group name, group 3")).toHaveValue("Floors 3 to 11");
    await expect(page.getByLabel("Number of floors above ground, group 3")).toHaveValue("9");
    await expect(page.getByLabel("Sellable share (%), group 3")).toHaveValue("75");
  });
});
