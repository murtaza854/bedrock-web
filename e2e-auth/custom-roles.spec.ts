import { API, PEOPLE, expect, test } from "./fixtures";

// Custom roles: a name plus, for each tab, the letters c r u d it may use. The server enforces them.
const plotBody = (no: string) => ({ area: "Role Town", plot_no: `${no}-${Date.now()}`, size_sqyd: 400 });
const unique = (s: string) => `${s}${Date.now()}`.slice(0, 40);

test.describe("Custom roles", () => {
  test("the API gives a role exactly the letters it was given, tab by tab", async ({ as, owner, newPerson }) => {
    const name = unique("Analyst");
    const made = await owner.post(`${API}/admin/roles`, { data: { name, perms: { plots: "cr", feasibility: "cru", tasks: "r" } } });
    expect(made.ok(), await made.text()).toBeTruthy();
    const plot = await (await owner.post(`${API}/plots`, { data: plotBody("ROLE") })).json();
    const who = await newPerson(name);
    const { request } = await as(who);
    const status = async (method: "get" | "post" | "put" | "patch" | "delete", path: string, data: object = {}) => (await request[method](`${API}${path}`, method === "get" || method === "delete" ? {} : { data })).status();

    expect(await status("get", "/plots")).toBe(200); // plots: create and read
    expect(await status("post", "/plots", plotBody("MINE"))).toBe(200);
    expect(await status("patch", `/plots/${plot.id}`, { sector: "x" })).toBe(403); // but not update
    expect(await status("get", `/plots/${plot.id}/financial-models`)).toBe(200); // feasibility: create, read and update
    const m = await (await request.post(`${API}/plots/${plot.id}/financial-models`, { data: { name: "Mine" } })).json();
    expect(await status("put", `/financial-models/${m.id}`, { ...m, name: "Renamed", land_price: 1 })).not.toBe(403);
    expect(await status("post", `/financial-models/${m.id}/primary`)).toBe(200); // an action on something that exists is an update
    expect(await status("post", "/financial/compute", { plot_id: plot.id })).not.toBe(403); // a calculation only needs read
    expect(await status("delete", `/financial-models/${m.id}`)).toBe(403); // no Delete
    expect(await status("get", "/negotiations")).toBe(403); // offers: nothing
    expect(await status("get", "/tasks")).toBe(200); // tasks: read only
    expect(await status("post", "/tasks", { title: "x" })).toBe(403);
    expect(await status("get", "/contacts")).toBe(403);
    expect(await status("get", "/admin/users")).toBe(403);
  });

  test("a role must be able to read what it can change, names are unique, and built-in roles stay as they are", async ({ owner, newPerson }) => {
    const bad = await owner.post(`${API}/admin/roles`, { data: { name: unique("NoRead"), perms: { plots: "u" } } });
    expect(bad.status()).toBe(400);
    expect(await bad.text()).toContain("Read");
    const unknown = await owner.post(`${API}/admin/roles`, { data: { name: unique("Odd"), perms: { nonsense: "r" } } });
    expect(unknown.status()).toBe(400);
    const name = unique("Unique");
    expect((await owner.post(`${API}/admin/roles`, { data: { name, perms: { plots: "r" } } })).ok()).toBeTruthy();
    expect((await owner.post(`${API}/admin/roles`, { data: { name, perms: { plots: "r" } } })).status()).toBe(409);
    const list = await (await owner.get(`${API}/admin/roles`)).json();
    const owners = list.roles.find((r: any) => r.name === "owner");
    expect(owners.builtin).toBe(true);
    expect((await owner.put(`${API}/admin/roles/${owners.id}`, { data: { name: "owner", perms: { plots: "r" } } })).status()).toBe(404); // built in: cannot be changed
    expect((await owner.delete(`${API}/admin/roles/${owners.id}`)).status()).toBe(400);
    // a role in use cannot be deleted until its people have another one
    const used = unique("Used");
    const id = (await (await owner.post(`${API}/admin/roles`, { data: { name: used, perms: { plots: "r" } } })).json()).id;
    const who = await newPerson(used);
    expect((await owner.delete(`${API}/admin/roles/${id}`)).status()).toBe(409);
    const users = await (await owner.get(`${API}/admin/users`)).json();
    const them = users.find((u: any) => u.email === who.email);
    expect((await owner.patch(`${API}/admin/users/${them.id}`, { data: { role: "viewer" } })).ok()).toBeTruthy();
    expect((await owner.delete(`${API}/admin/roles/${id}`)).ok()).toBeTruthy();
  });

  test("a role that can only read plots can open a plot's files but not add or delete them", async ({ as, owner, newPerson }) => {
    const plot = await (await owner.post(`${API}/plots`, { data: plotBody("FILE") })).json();
    const mine = await (await owner.post(`${API}/plots/${plot.id}/files`, { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }, label: "Lease" } })).json();
    const name = unique("FileReader");
    expect((await owner.post(`${API}/admin/roles`, { data: { name, perms: { plots: "r" } } })).ok()).toBeTruthy();
    const { request } = await as(await newPerson(name));
    expect((await request.get(`${API}/plots/${plot.id}/files`)).status()).toBe(200);
    expect((await request.get(`${API}/files/${mine.id}`)).status()).toBe(200);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    expect((await request.post(`${API}/plots/${plot.id}/files`, { multipart: { file: { name: "b.png", mimeType: "image/png", buffer: png } } })).status()).toBe(403);
    expect((await request.delete(`${API}/files/${mine.id}`)).status()).toBe(403);
  });

  test("a role with Admin access cannot manage roles or take over an owner", async ({ as, owner, newPerson }) => {
    const name = unique("Helper");
    expect((await owner.post(`${API}/admin/roles`, { data: { name, perms: { plots: "r", admin: "crud" } } })).ok()).toBeTruthy();
    const { request } = await as(await newPerson(name));
    expect((await request.get(`${API}/admin/users`)).status()).toBe(200); // Admin read works
    expect((await request.post(`${API}/admin/roles`, { data: { name: unique("Mine"), perms: { plots: "r" } } })).status()).toBe(403); // roles: owners only
    const users = await (await request.get(`${API}/admin/users`)).json();
    const theOwner = users.find((u: any) => u.email === PEOPLE.owner.email);
    expect((await request.post(`${API}/admin/users/${theOwner.id}/password`, { data: { password: "Takeover-pass-1" } })).status()).toBe(403);
    expect((await request.patch(`${API}/admin/users/${theOwner.id}`, { data: { disabled: true } })).status()).toBe(403);
    expect((await request.post(`${API}/admin/users`, { data: { email: `x${Date.now()}@e2e.test`, password: "Fresh-pass-12345", name: "", role: "owner" } })).status()).toBe(403); // cannot make an owner
  });

  test("the sidebar and pages follow the role: tabs it cannot read are gone, and opening one by address says so", async ({ as, owner, newPerson }) => {
    const name = unique("Reader");
    expect((await owner.post(`${API}/admin/roles`, { data: { name, perms: { plots: "r", tasks: "r" } } })).ok()).toBeTruthy();
    const { page } = await as(await newPerson(name));
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Plots", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Tasks", exact: true })).toBeVisible();
    for (const hidden of ["Offers", "Contacts", "Bylaws", "Scorecard", "Map", "Admin"]) await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
    await page.goto("/dashboard/contacts");
    await expect(page.getByRole("heading", { name: "Not available to you" })).toBeVisible();
  });

  test("the owner makes, changes and deletes a role in the Roles tab, and can give it to a person", async ({ as }) => {
    const { page } = await as(PEOPLE.owner);
    const name = unique("Screen");
    await page.goto("/dashboard/admin");
    await page.getByRole("button", { name: "Roles", exact: true }).click();
    await page.getByRole("button", { name: "New role" }).click();
    await page.getByLabel("Role name").fill(name);
    await page.getByLabel("Plots, quotes and facts Update").check(); // Update needs Read, so Read comes with it
    await expect(page.getByLabel("Plots, quotes and facts Read")).toBeChecked();
    await page.getByLabel("Plots, quotes and facts Read").uncheck(); // and taking Read away takes the rest with it
    await expect(page.getByLabel("Plots, quotes and facts Update")).not.toBeChecked();
    await page.getByLabel("Plots, quotes and facts Read").check();
    await page.getByLabel("Tasks Create").check();
    await page.getByRole("button", { name: "Create role" }).click();
    const row = page.getByRole("row", { name: new RegExp(`^${name}`, "i") });
    await expect(row).toBeVisible();

    await page.getByRole("button", { name: "Users", exact: true }).click(); // the new role can be given to a person
    await page.getByRole("button", { name: "Add a person" }).click();
    await page.getByRole("combobox", { name: "Role", exact: true }).click();
    await expect(page.getByRole("option", { name: new RegExp(name, "i") })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Roles", exact: true }).click();
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Tasks Create")).toBeChecked(); // saved
    await page.getByRole("button", { name: "Cancel" }).click();
    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete role" }).click();
    await expect(row).toHaveCount(0);
  });
});
