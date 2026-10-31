import { API, bought, expect, test } from "./fixtures";

// Every page at a phone width (375 x 812): nothing may push the page sideways, and the content must keep a usable width.
test.use({ viewport: { width: 375, height: 812 } });

test("every page fits a phone screen", async ({ page, plot, request }) => {
  test.setTimeout(240_000);
  const p = await plot({ area: "Mobile Town", size_sqyd: 400, gps_lat: 24.79, gps_lon: 67.07 });
  await request.post(`${API}/plots/${p.id}/quotes`, { data: { broker: "Broker with a long name Associates", quote_type: "asking", price_pkr: 630_000_000, inclusions: "everything included" } });
  await request.post(`${API}/plots/${p.id}/claims`, { data: { field: "road_width_ft", value: "60", source: "site visit", verification: "claimed" } });
  const n = await (await request.post(`${API}/plots/${p.id}/negotiations`, { data: { counterparty: "Seller", side: "theirs", amount_pkr: 640_000_000, made_on: "2024-01-01", valid_until: null, terms: "" } })).json();
  const m = await (await request.post(`${API}/plots/${p.id}/financial-models`, { data: { name: "Demand" } })).json();
  const floors = [{ label: "Ground", floor_type: "ground", use: "shop", built_area_sqft: 3000, sellable_ratio: 1, ratio_verification: "claimed", price_mode: "per_sqft", price_per_sqft: 120000, fixed_unit_price: 0, unit_count: 0, price_basis_confirmed: false, price_verification: "claimed" }];
  await request.put(`${API}/financial-models/${m.id}`, { data: { ...m, floors, construction_per_sqft: 6000, land_price: 630_000_000, land_price_basis: "manual", target_margin: 0.2, construction_months: 24 } });
  await bought(request, p.id);

  const paths = ["/dashboard", "/dashboard/plots", "/dashboard/plots/new", `/dashboard/plots/${p.id}`, `/dashboard/plots/${p.id}/edit`, `/dashboard/plots/${p.id}/setup`,
    `/dashboard/plots/${p.id}/feasibility`, `/dashboard/plots/${p.id}/financials`, `/dashboard/plots/${p.id}/report`, `/dashboard/plots/${p.id}/score`,
    "/dashboard/tasks", "/dashboard/offers", "/dashboard/offers/new", `/dashboard/offers/${n.id}`, "/dashboard/contacts", "/dashboard/contacts/new", "/dashboard/bylaws", "/dashboard/bylaws/new",
    "/dashboard/scorecard", "/dashboard/scorecard/rules", "/dashboard/settings", "/dashboard/settings/rates", "/dashboard/map", "/dashboard/account", "/dashboard/admin", "/login", "/forgot"];
  const bad: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(1200); // let the data arrive
    const r = await page.evaluate(() => {
      const w = window.innerWidth;
      const main = document.querySelector("main")?.getBoundingClientRect().width ?? document.body.getBoundingClientRect().width;
      // elements that stick out past the right edge, unless a scrolling box around them contains it
      const clipped = (el: Element) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return true; } return false; };
      const stick = (el: Element) => el.getBoundingClientRect().right > w + 1 && !clipped(el);
      // the innermost ones: an element that sticks out only because a child does is not the cause
      const out = [...document.querySelectorAll("main *")].filter((el) => stick(el) && ![...el.children].some(stick))
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right).slice(0, 3)
        .map((el) => `<${el.tagName.toLowerCase()} class="${String(el.getAttribute("class") ?? "").slice(0, 90)}"> ${(el.textContent ?? "").trim().slice(0, 30)}`);
      return { over: document.documentElement.scrollWidth - w, main: Math.round(main), out };
    });
    // sideways scroll, or content squeezed into less than 300 of the 375 pixels
    if (r.over > 1 || r.main < 300) bad.push(`${path}: ${r.over > 1 ? `scrolls sideways by ${r.over}px` : ""}${r.main < 300 ? ` content only ${r.main}px wide` : ""} | ${r.out.join(" | ")}`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("on a phone the menu slides over the page and closes after you choose a page", async ({ page }) => {
  await page.goto("/dashboard");
  const plots = page.getByRole("navigation").getByRole("link", { name: "Plots", exact: true });
  await expect(plots).not.toBeInViewport(); // the menu starts closed, so the page gets the whole screen
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(plots).toBeInViewport();
  await plots.click();
  await expect(page).toHaveURL(/\/dashboard\/plots$/);
  await expect(plots).not.toBeInViewport(); // closed again
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(plots).not.toBeInViewport();
});
