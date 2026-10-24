import { defineConfig, devices } from "@playwright/test";

// End-to-end tests. `npm run test:e2e` starts two separate set-ups, each with its own API, throwaway database and
// built copy of the site, so it never touches the servers or data you use day to day. Needs Postgres from `make db`.
//   main  (e2e/)       API 8101, site 3101: sign-in is off, like day-to-day development.
//   auth  (e2e-auth/)  API 8102, site 3102: sign-in is on, with an owner, an editor and a viewer already created.
// Run one half with:  npm run test:e2e -- --project=main   (or --project=auth)
// Watch it work:      SLOWMO=600 npm run test:e2e -- --headed --project=main e2e/plots.spec.ts
// Step through it:    npm run test:e2e -- --ui
const site = (port: number, api: number, dist: string) => ({
  // a production build, not `next dev`: every page is ready at once, so no test waits on a first-time compile
  command: "node node_modules/next/dist/bin/next build && node node_modules/next/dist/bin/next start -p " + port,
  url: `http://localhost:${port}/login`, timeout: 300_000, reuseExistingServer: false,
  env: { NEXT_PUBLIC_API: `http://localhost:${api}`, NEXT_DIST: dist },
});

export default defineConfig({
  workers: 1, // the tests share a database
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  // SLOWMO=600 pauses that many milliseconds between actions, so a --headed run is slow enough to follow
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure", launchOptions: { slowMo: Number(process.env.SLOWMO) || 0 } },
  projects: [
    { name: "main", testDir: "./e2e", use: { baseURL: "http://localhost:3101" } },
    { name: "auth", testDir: "./e2e-auth", use: { baseURL: "http://localhost:3102" } },
  ],
  webServer: [
    { command: "sh e2e/start-api.sh", url: "http://localhost:8101/me", timeout: 180_000, reuseExistingServer: false },
    site(3101, 8101, ".next-e2e"),
    { command: "sh e2e-auth/start-api.sh", url: "http://localhost:8102/me", timeout: 180_000, reuseExistingServer: false },
    site(3102, 8102, ".next-e2e-auth"),
  ],
});
