import { API, expect, test } from "./fixtures";

// The four built-in roles. "manager" is everything except the Admin area: no user management, no audit log, no backups.
test.describe("Built-in roles", () => {
  test("owner, editor, manager and viewer exist; the manager has every area except Admin", async ({ owner }) => {
    const { roles } = await (await owner.get(`${API}/admin/roles`)).json();
    const byName = Object.fromEntries(roles.map((r: any) => [r.name, r]));
    for (const n of ["owner", "editor", "manager", "viewer"]) expect(byName[n]?.builtin, n).toBe(true);
    const perms = byName.manager.perms as Record<string, string>;
    expect(perms.admin).toBe("");
    for (const [area, letters] of Object.entries(perms)) if (area !== "admin") expect(letters, area).toBe("crud");
  });

  test("a manager can use everything but Admin, and cannot edit other people", async ({ as, owner, newPerson }) => {
    const who = await newPerson("manager");
    const { request } = await as(who);
    expect((await request.get(`${API}/plots`)).status()).toBe(200);
    expect((await request.get(`${API}/negotiations`)).status()).toBe(200); // money
    expect((await request.get(`${API}/admin/users`)).status()).toBe(403);
    expect((await request.get(`${API}/admin/audit`)).status()).toBe(403);
    const id = (await (await owner.get(`${API}/admin/users`)).json())[0].id;
    expect((await request.patch(`${API}/admin/users/${id}`, { data: { role: "viewer" } })).status()).toBe(403);
    expect((await request.post(`${API}/admin/users/${id}/password`, { data: { password: "Granite-lantern-3092" } })).status()).toBe(403);
    expect((await request.post(`${API}/account/name`, { data: { name: "My Own Name" } })).status()).toBe(204); // their own name is theirs to change
  });
});
