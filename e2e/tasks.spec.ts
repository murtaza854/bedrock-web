import { API, expect, test } from "./fixtures";

const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString("en-CA"); };
const section = (page: any, heading: string) => page.locator("section", { has: page.getByRole("heading", { name: new RegExp(`^${heading}`) }) });

async function task(request: any, data: Record<string, unknown>) {
  const r = await request.post(`${API}/tasks`, { data: { notes: "", priority: "normal", due_on: null, plot_id: null, party_id: null, ...data } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

test.describe("Adding and changing tasks", () => {
  test("a task needs a title; a saved task lands under the right heading with its priority and plot", async ({ page, plot }) => {
    const p = await plot({ plot_no: "TASK-ADD" });
    await page.goto("/dashboard/tasks");
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByText("Give the task a title")).toBeVisible();

    await page.getByPlaceholder("What needs doing?").fill("Call the owner about TASK-ADD");
    await page.locator('input[name="due_on"]').fill(day(0));
    await page.getByRole("combobox", { name: "Priority" }).click();
    await page.getByRole("option", { name: "High" }).click();
    await page.getByRole("combobox", { name: "Plot" }).click();
    await page.getByRole("option", { name: /TASK-ADD/ }).click();
    await page.getByRole("button", { name: "Add task" }).click();

    const today = section(page, "Today");
    const item = today.locator("li", { hasText: "Call the owner about TASK-ADD" });
    await expect(item).toBeVisible();
    await expect(item).toContainText("High");
    await expect(item.getByRole("link", { name: /TASK-ADD/ })).toHaveAttribute("href", `/dashboard/plots/${p.id}`);
  });

  test("tasks are grouped by how soon they are due", async ({ page, request }) => {
    await task(request, { title: "G-overdue", due_on: day(-3) });
    await task(request, { title: "G-today", due_on: day(0) });
    await task(request, { title: "G-week", due_on: day(4) });
    await task(request, { title: "G-later", due_on: day(30) });
    await task(request, { title: "G-nodate" });
    await page.goto("/dashboard/tasks");
    await expect(section(page, "Overdue")).toContainText("G-overdue");
    await expect(section(page, "Today")).toContainText("G-today");
    await expect(section(page, "Next 7 days")).toContainText("G-week");
    await expect(section(page, "Later")).toContainText("G-later");
    await expect(section(page, "No date")).toContainText("G-nodate");
    await expect(section(page, "Overdue")).not.toContainText("G-today");
  });

  test("completing a task moves it to Completed, and Undo brings it back", async ({ page, request }) => {
    await task(request, { title: "Finish me", due_on: day(1) });
    await page.goto("/dashboard/tasks");
    await page.getByRole("button", { name: 'Mark "Finish me" done' }).click();
    await expect(page.getByText("Finish me")).toHaveCount(0);
    await page.getByRole("button", { name: /^Completed/ }).click();
    const done = page.locator("li", { hasText: "Finish me" });
    await expect(done).toBeVisible();
    await done.getByRole("button", { name: "Undo" }).click();
    await expect(section(page, "Next 7 days")).toContainText("Finish me");
  });

  test("editing changes the title and the date", async ({ page, request }) => {
    await task(request, { title: "Old title", due_on: day(2) });
    await page.goto("/dashboard/tasks");
    await page.locator("li", { hasText: "Old title" }).getByRole("button", { name: "Edit" }).click();
    await page.getByPlaceholder("What needs doing?").fill("New title");
    await page.locator('input[name="due_on"]').fill(day(0));
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(section(page, "Today")).toContainText("New title");
    await expect(page.getByText("Old title")).toHaveCount(0);
  });

  test("deleting asks first, and Keep cancels", async ({ page, request }) => {
    await task(request, { title: "Delete me" });
    await page.goto("/dashboard/tasks");
    const item = page.locator("li", { hasText: "Delete me" });
    await item.getByRole("button", { name: "Delete", exact: true }).click();
    await item.getByRole("button", { name: "Keep" }).click();
    await expect(item).toBeVisible();
    await item.getByRole("button", { name: "Delete", exact: true }).click();
    await item.getByRole("button", { name: "Delete", exact: true }).click(); // the confirm
    await expect(page.getByText("Delete me")).toHaveCount(0);
  });
});

test.describe("Reminders Bedrock raises", () => {
  test("a due follow-up appears and can be marked done from here", async ({ page, request }) => {
    const c = await (await request.post(`${API}/contacts`, { data: { name: "Reminder Person", phone: "", email: "", company: "", notes: "", roles: ["broker"] } })).json();
    await request.post(`${API}/contacts/${c.id}/log`, { data: { kind: "call", summary: "Ring back about the lane", plot_id: null, followup_on: day(0) } });
    await page.goto("/dashboard/tasks");
    const item = section(page, "Today").locator("li", { hasText: "Follow up with Reminder Person" });
    await expect(item).toContainText("Follow-up");
    await expect(item).toContainText("Ring back about the lane");
    await item.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Follow up with Reminder Person")).toHaveCount(0);
  });

  test("an offer waiting for our reply shows as a reminder", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "REM-OFFER" });
    const n = await (await request.post(`${API}/plots/${p.id}/negotiations`, { data: { counterparty: "Reply Seller", side: "theirs", amount_pkr: 700_000_000, made_on: day(), terms: "" } })).json();
    await page.goto("/dashboard/tasks");
    const item = page.locator("li", { hasText: "Reply to Reply Seller" });
    await expect(item).toBeVisible();
    await expect(item).toContainText("PKR 700,000,000");
    await item.getByRole("link", { name: "Open →" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/offers/${n.id}$`));
  });
});

test.describe("On a plot", () => {
  test("the plot page lists its open tasks and can complete one", async ({ page, plot, request }) => {
    const p = await plot({ plot_no: "TASK-PLOT" });
    await task(request, { title: "Check the boundary wall", plot_id: p.id, due_on: day(1) });
    await page.goto(`/dashboard/plots/${p.id}`);
    const tasks = page.locator("section", { has: page.getByRole("heading", { name: /^Tasks/ }) });
    await expect(tasks).toContainText("1 open");
    await expect(tasks).toContainText("Check the boundary wall");
    await tasks.getByRole("button", { name: 'Mark "Check the boundary wall" done' }).click();
    await expect(tasks).toContainText("No open tasks for this plot.");
  });

  test("+ Add task opens the form with that plot already chosen", async ({ page, plot }) => {
    const p = await plot({ plot_no: "TASK-PRE" });
    await page.goto(`/dashboard/plots/${p.id}`);
    await page.getByRole("link", { name: "+ Add task" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/tasks\\?plot=${p.id}$`));
    await expect(page.getByRole("combobox", { name: "Plot" })).toContainText("TASK-PRE");
  });
});
