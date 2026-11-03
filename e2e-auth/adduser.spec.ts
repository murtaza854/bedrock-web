import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { PEOPLE, API, expect, test } from "./fixtures";

// `make adduser` is only for the very first owner. These run the real command against the sign-in test server's database
// (where people already exist) and against an empty one made for the test.
const BIN = join(process.env.TMPDIR || "/tmp", "bedrock-e2e-auth-api");
const ADMIN = process.env.E2E_ADMIN_URL ?? "postgres://murtaza854@localhost:5432/postgres";
const base = ADMIN.slice(0, ADMIN.lastIndexOf("/"));
const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const run = (db: string, args: string[], input = "", cmd = "adduser") =>
  spawnSync(BIN, [cmd, ...args], { env: { ...process.env, DATABASE_URL: `${base}/${db}`, DOCS_KEY: KEY, DOCS_DIR: join(process.env.TMPDIR || "/tmp", "bedrock-adduser-docs") }, input, encoding: "utf8" });
const psql = (db: string, sql: string) => execFileSync("psql", [`${base}/${db}`, "-tAq", "-c", sql], { encoding: "utf8" }).trim();

test.describe("make adduser", () => {
  test("it is closed once anybody exists, whatever the email or role", async ({ owner }) => {
    for (const args of [["late@e2e.test"], [PEOPLE.owner.email], ["late2@e2e.test", "owner"]]) {
      const r = run("bedrock_e2e_auth", args, "Late-pass-12345\nLate-pass-12345\n");
      expect(r.status, args.join(" ")).not.toBe(0);
      expect(r.stderr).toContain("only creates the very first owner");
    }
    const people = await (await owner.get(`${API}/admin/users`)).json();
    expect(people.some((u: any) => u.email.startsWith("late"))).toBe(false); // nobody was added, and nobody changed
  });

  test("on an empty database it makes one owner with no password, prints a link to choose one, writes the audit log, then closes", async () => {
    const db = "bedrock_e2e_adduser";
    execFileSync("psql", [`${ADMIN}`, "-q", "-c", `drop database if exists ${db} with (force)`, "-c", `create database ${db}`]);
    try {
      execFileSync("psql", [`${base}/${db}`, "-q", "-v", "ON_ERROR_STOP=1", "-f", "../bedrock-api/schema.sql"], { env: { ...process.env, PGOPTIONS: "--client-min-messages=warning" } });
      expect(run(db, ["first@e2e.test", "viewer"]).stderr).toContain("must be an owner");
      expect(run(db, ["not-an-email"]).stderr).toContain("valid email");
      expect(psql(db, "select count(*) from users")).toBe("0"); // none of that created anyone

      const ok = run(db, ["First@E2E.test", "owner", "  First Owner  "]);
      expect(ok.status, ok.stderr).toBe(0);
      expect(ok.stderr).toMatch(/\/welcome\?token=[0-9a-f]{20,}/);
      expect(psql(db, "select email || ' ' || role || ' ' || onboarding || ' ' || (password_hash = '!') || ' ' || name from users")).toBe("first@e2e.test owner true true First Owner"); // the name is kept, trimmed
      expect(psql(db, "select count(*) from audit_log where action like 'first owner created%'")).toBe("1");
      const again = run(db, ["second@e2e.test"]);
      expect(again.status).not.toBe(0);
      expect(psql(db, "select count(*) from users")).toBe("1");

      const fresh = run(db, ["first@e2e.test"], "", "invite"); // `make invite` gives a new link while no password is chosen
      expect(fresh.status, fresh.stderr).toBe(0);
      expect(fresh.stderr).toContain("/welcome?token=");
      expect(fresh.stderr).not.toBe(ok.stderr);
    } finally {
      execFileSync("psql", [`${ADMIN}`, "-q", "-c", `drop database if exists ${db} with (force)`]);
    }
  });
});
