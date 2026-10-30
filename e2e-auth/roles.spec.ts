import { API, PEOPLE, expect, test } from "./fixtures";

const plotBody = (no: string) => ({ area: "Role Area", plot_no: no, size_sqyd: 400 });

test.describe("What each role is allowed to do (checked against the API itself)", () => {
  test("a viewer can read plots and settings, and nothing else", async ({ as }) => {
    const { request } = await as(PEOPLE.viewer);
    for (const path of ["/plots", "/me", "/stats", "/settings", "/bylaws", "/contacts", "/score/ranking"]) expect((await request.get(`${API}${path}`)).status(), `GET ${path}`).toBe(200);
    for (const path of ["/negotiations", "/rates", "/admin/users", "/admin/audit", "/admin/backups"]) expect((await request.get(`${API}${path}`)).status(), `GET ${path}`).toBe(403);
    expect((await request.post(`${API}/plots`, { data: plotBody("V-1") })).status()).toBe(403);
    expect((await request.patch(`${API}/plots/1`, { data: { size_sqyd: 1 } })).status()).toBe(403);
    expect((await request.post(`${API}/contacts`, { data: { name: "x", roles: ["broker"] } })).status()).toBe(403);
    expect((await request.put(`${API}/admin/settings`, { data: { project_name: "x" } })).status()).toBe(403);
  });

  test("an editor can do everything except administration", async ({ as }) => {
    const { request } = await as(PEOPLE.editor);
    const made = await request.post(`${API}/plots`, { data: plotBody("E-1") });
    expect(made.status()).toBe(200);
    const plot = await made.json();
    expect((await request.get(`${API}/negotiations`)).status()).toBe(200);
    expect((await request.get(`${API}/plots/${plot.id}/financial-models`)).status()).toBe(200);
    expect((await request.get(`${API}/rates`)).status()).toBe(200);
    expect((await request.post(`${API}/plots/${plot.id}/quotes`, { data: { broker: "B", quote_type: "asking", price_pkr: 1000, inclusions: "" } })).status()).toBe(200);
    for (const path of ["/admin/users", "/admin/audit", "/admin/backups", "/admin/summary"]) expect((await request.get(`${API}${path}`)).status(), `GET ${path}`).toBe(403);
    expect((await request.put(`${API}/admin/settings`, { data: { project_name: "x" } })).status()).toBe(403);
    expect((await request.post(`${API}/admin/users`, { data: { email: "z@e2e.test", role: "viewer", password: "Some-pass-12345" } })).status()).toBe(403);
  });

  test("an owner can reach administration", async ({ as }) => {
    const { request } = await as(PEOPLE.owner);
    for (const path of ["/admin/users", "/admin/audit", "/admin/backups", "/admin/summary", "/negotiations", "/rates"]) expect((await request.get(`${API}${path}`)).status(), `GET ${path}`).toBe(200);
  });

  test("an unknown role in the API is refused when adding a person", async ({ owner }) => {
    const r = await owner.post(`${API}/admin/users`, { data: { email: "bad-role@e2e.test", role: "lawyer", password: "Some-pass-12345" } });
    expect(r.status()).toBe(400); // the lawyer role was removed
  });
});

test.describe("What each role sees on screen", () => {
  test("the sidebar: a viewer has no money links or Admin, an editor has money but not Admin, an owner has both", async ({ as }) => {
    const nav = (s: any) => s.page.getByRole("navigation");
    const viewer = await as(PEOPLE.viewer);
    await viewer.page.goto("/dashboard");
    await expect(nav(viewer).getByRole("link", { name: "Plots", exact: true })).toBeVisible();
    await expect(nav(viewer).getByRole("link", { name: "Offers", exact: true })).toHaveCount(0);
    await expect(nav(viewer).getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

    const editor = await as(PEOPLE.editor);
    await editor.page.goto("/dashboard");
    await expect(nav(editor).getByRole("link", { name: "Offers", exact: true })).toBeVisible();
    await expect(nav(editor).getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

    const owner = await as(PEOPLE.owner);
    await owner.page.goto("/dashboard");
    await expect(nav(owner).getByRole("link", { name: "Offers", exact: true })).toBeVisible();
    await expect(nav(owner).getByRole("link", { name: "Admin", exact: true })).toBeVisible();
  });

  test("on a plot, a viewer does not see the money sections, an editor does", async ({ as, owner }) => {
    const plot = await (await owner.post(`${API}/plots`, { data: plotBody("SEE-MONEY") })).json();
    const heading = (s: any, name: RegExp) => s.page.getByRole("heading", { name });
    const viewer = await as(PEOPLE.viewer);
    await viewer.page.goto(`/dashboard/plots/${plot.id}`);
    await expect(heading(viewer, /^Quotes/)).toBeVisible();
    for (const name of [/^Feasibility/, /^Offers/, /^Purchase/]) await expect(heading(viewer, name)).toHaveCount(0);

    const editor = await as(PEOPLE.editor);
    await editor.page.goto(`/dashboard/plots/${plot.id}`);
    await expect(heading(editor, /^Feasibility/)).toBeVisible();
    await expect(heading(editor, /^Offers/)).toBeVisible();
  });

  test("a viewer who tries to save something is told it could not be saved, and nothing is stored", async ({ as, owner }) => {
    const plot = await (await owner.post(`${API}/plots`, { data: plotBody("V-TRY") })).json();
    const { page } = await as(PEOPLE.viewer);
    await page.goto(`/dashboard/plots/${plot.id}`);
    await page.getByRole("button", { name: "+ Add quote" }).click();
    await page.getByPlaceholder("Broker").fill("Sneaky");
    await page.getByPlaceholder("Price (PKR)").fill("5000");
    await page.getByRole("button", { name: "Save quote" }).click();
    await expect(page.getByText("Could not save, try again")).toBeVisible();
    const saved = await (await owner.get(`${API}/plots/${plot.id}`)).json();
    expect(saved.quotes).toHaveLength(0);
  });

  test("a non-owner opening Admin is told it is for owners; settings are visible but locked", async ({ as }) => {
    const editor = await as(PEOPLE.editor);
    await editor.page.goto("/dashboard/admin");
    await expect(editor.page.getByText("Only an owner can open this page.")).toBeVisible();
    await editor.page.goto("/dashboard/settings");
    await expect(editor.page.getByText("Only an owner can change these.")).toBeVisible();
    await expect(editor.page.getByPlaceholder("Shown under Bedrock")).toBeDisabled();
    await expect(editor.page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  });

  test("a viewer who opens a money page by its address sees none of its data", async ({ as, owner }) => {
    const plot = await (await owner.post(`${API}/plots`, { data: plotBody("V-FIN") })).json();
    const { page, request } = await as(PEOPLE.viewer);
    expect((await request.get(`${API}/plots/${plot.id}/financial-models`)).status()).toBe(403);
    for (const path of [`/dashboard/plots/${plot.id}/financials`, "/dashboard/offers", "/dashboard/settings/rates"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("main"), path).not.toContainText(/Open negotiations|Stamp duty|Our latest offer|Break-even/);
    }
  });

  test("a viewer who opens a money page is told it is not available to them, and its data is never requested", async ({ as, owner }) => {
    const plot = await (await owner.post(`${API}/plots`, { data: plotBody("V-MSG") })).json();
    const { page } = await as(PEOPLE.viewer);
    const asked: string[] = [];
    page.on("request", (r) => { if (r.url().startsWith(API) && /\/(negotiations|rates|financial)/.test(new URL(r.url()).pathname)) asked.push(r.url()); }); // calls to the API, not the pages themselves
    for (const path of [`/dashboard/plots/${plot.id}/financials`, "/dashboard/offers", "/dashboard/offers/new", "/dashboard/offers/1", "/dashboard/settings/rates"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Not available to you" }), path).toBeVisible();
      await expect(page.getByRole("main"), path).toContainText("owners and editors");
    }
    expect(asked, "a viewer's browser should not even ask for money data").toEqual([]);
  });

  test("an editor still gets the real pages", async ({ as, owner }) => {
    const plot = await (await owner.post(`${API}/plots`, { data: plotBody("E-REAL") })).json();
    await owner.post(`${API}/plots/${plot.id}/purchase`, { data: { price_pkr: 1_000_000, bought_on: "2024-01-01", seller: "S", note: "" } }); // the detailed model opens for a bought plot
    const { page } = await as(PEOPLE.editor);
    await page.goto("/dashboard/offers");
    await expect(page.getByRole("heading", { name: "Offers" })).toBeVisible();
    await page.goto(`/dashboard/plots/${plot.id}/financials`);
    await expect(page.getByRole("heading", { name: "Financial feasibility" })).toBeVisible();
    await page.goto("/dashboard/settings/rates");
    await expect(page.getByRole("heading", { name: "Tax and fee rates" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not available to you" })).toHaveCount(0);
  });

  test("the pages a viewer may use are unaffected", async ({ as }) => {
    const { page } = await as(PEOPLE.viewer);
    for (const [path, heading] of [["/dashboard/plots", "Plots"], ["/dashboard/scorecard", "Scorecard"], ["/dashboard/bylaws", "Bylaws"], ["/dashboard/settings", "Settings"], ["/dashboard/contacts", "Contacts"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, exact: true }).first(), path).toBeVisible();
    }
  });
});
