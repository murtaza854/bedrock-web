import { API, expect, test } from "./fixtures";

// The four built-in roles. "director" is everything except the Admin area (no user management, audit log or backups) and the Settings area.
test.describe("Built-in roles", () => {
  test("owner, editor, director and viewer exist; the director has every area except Admin and Settings", async ({ owner }) => {
    const { roles } = await (await owner.get(`${API}/admin/roles`)).json();
    const byName = Object.fromEntries(roles.map((r: any) => [r.name, r]));
    for (const n of ["owner", "editor", "director", "viewer"]) expect(byName[n]?.builtin, n).toBe(true);
    const perms = byName.director.perms as Record<string, string>;
    expect(perms.admin).toBe("");
    expect(perms.settings).toBe("");
    for (const [area, letters] of Object.entries(perms)) if (area !== "admin" && area !== "settings") expect(letters, area).toBe("crud");
    expect(byName.manager).toBeUndefined(); // the old name is gone
  });

  test("a director can use everything but Admin and Settings, and cannot edit other people", async ({ as, owner, newPerson }) => {
    const who = await newPerson("director");
    const { request } = await as(who);
    expect((await request.get(`${API}/plots`)).status()).toBe(200);
    expect((await request.get(`${API}/negotiations`)).status()).toBe(200); // money
    expect((await request.get(`${API}/settings`)).status()).toBe(200); // the app reads the thresholds on every page
    expect((await request.put(`${API}/admin/settings`, { data: { project_name: "x" } })).status()).toBe(403); // but changing them is not allowed
    expect((await request.get(`${API}/admin/users`)).status()).toBe(403);
    expect((await request.get(`${API}/admin/audit`)).status()).toBe(403);
    const id = (await (await owner.get(`${API}/admin/users`)).json())[0].id;
    expect((await request.patch(`${API}/admin/users/${id}`, { data: { role: "viewer" } })).status()).toBe(403);
    expect((await request.post(`${API}/admin/users/${id}/password`, { data: { password: "Granite-lantern-3092" } })).status()).toBe(403);
    expect((await request.post(`${API}/account/name`, { data: { first_name: "My", last_name: "Own Name" } })).status()).toBe(204); // their own name is theirs to change
  });
});
