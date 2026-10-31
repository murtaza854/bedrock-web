import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { PEOPLE, API, expect, test } from "./fixtures";

// `make adduser` is only for the very first owner. These run the real command against the sign-in test server's database
// (where people already exist) and against an empty one made for the test.
const BIN = join(process.env.TMPDIR || "/tmp", "bedrock-e2e-auth-api");
const ADMIN = process.env.E2E_ADMIN_URL ?? "postgres://murtaza854@localhost:5432/postgres";
const base = ADMIN.slice(0, ADMIN.lastIndexOf("/"));
const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const run = (db: string, args: string[], input = "") =>
  spawnSync(BIN, ["adduser", ...args], { env: { ...process.env, DATABASE_URL: `${base}/${db}`, DOCS_KEY: KEY, DOCS_DIR: join(process.env.TMPDIR || "/tmp", "bedrock-adduser-docs") }, input, encoding: "utf8" });
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

  test("on an empty database it makes one owner, asks twice, checks the password, writes the audit log, then closes", async () => {
    const db = "bedrock_e2e_adduser";
    execFileSync("psql", [`${ADMIN}`, "-q", "-c", `drop database if exists ${db} with (force)`, "-c", `create database ${db}`]);
    try {
      execFileSync("psql", [`${base}/${db}`, "-q", "-v", "ON_ERROR_STOP=1", "-f", "../bedrock-api/schema.sql"], { env: { ...process.env, PGOPTIONS: "--client-min-messages=warning" } });
      expect(run(db, ["first@e2e.test", "viewer"], "First-pass-12345\nFirst-pass-12345\n").stderr).toContain("must be an owner");
      expect(run(db, ["not-an-email"], "First-pass-12345\nFirst-pass-12345\n").stderr).toContain("valid email");
      expect(run(db, ["first@e2e.test"], "First-pass-12345\nSomething-else-1\n").stderr).toContain("not the same");
      expect(run(db, ["first@e2e.test"], "short\nshort\n").stderr).toContain("at least 10 characters");
      expect(psql(db, "select count(*) from users")).toBe("0"); // none of that created anyone

      const ok = run(db, ["First@E2E.test"], "First-pass-12345\nFirst-pass-12345\n");
      expect(ok.status, ok.stderr).toBe(0);
      expect(psql(db, "select email || ' ' || role from users")).toBe("first@e2e.test owner");
      expect(psql(db, "select count(*) from audit_log where action like 'first owner created%'")).toBe("1");
      const again = run(db, ["second@e2e.test"], "Second-pass-12345\nSecond-pass-12345\n");
      expect(again.status).not.toBe(0);
      expect(psql(db, "select count(*) from users")).toBe("1");
    } finally {
      execFileSync("psql", [`${ADMIN}`, "-q", "-c", `drop database if exists ${db} with (force)`]);
    }
  });
});
