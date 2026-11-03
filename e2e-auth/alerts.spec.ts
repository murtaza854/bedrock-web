import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API, PEOPLE, expect, test } from "./fixtures";

// Sign-in alerts: a new kind of device (browser and system) gets an email; the first sign-in and known devices do not.
const OUTBOX = join(process.env.TMPDIR || "/tmp", "bedrock-e2e-auth-mail");
const mails = (to: string) => { try { return readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.to === to && m.subject === "New sign-in to Bedrock"); } catch { return []; } };
const copies = (about: string) => { try { return readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.to === PEOPLE.owner.email && m.subject === `New sign-in to Bedrock: ${about}`); } catch { return []; } };
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0";

test.describe("Sign-in alerts", () => {
  test("a new device is emailed once; the first sign-in and devices already used are not", async ({ request, newPerson }) => {
    const who = await newPerson("viewer");
    const signIn = async (ua: string) => expect((await request.post(`${API}/login`, { data: { email: who.email, password: who.password }, headers: { "User-Agent": ua } })).status()).toBe(204);

    await signIn(MAC); // the very first sign-in: nothing to compare with
    await request.post(`${API}/logout`, { data: {} });
    await signIn(WIN); // a device never used before
    await expect.poll(() => mails(who.email).length).toBe(1);
    const body = mails(who.email)[0].body as string;
    expect(body).toContain("Edge on Windows");
    expect(body).toContain("Sign out every other device");
    await expect.poll(() => copies(who.email).length).toBe(1); // and the owner is told whose account it was
    expect(copies(who.email)[0].body).toContain(who.email);

    await signIn(WIN); // the same again, and the first one again
    await signIn(MAC);
    await request.post(`${API}/logout`, { data: {} });
    await new Promise((r) => setTimeout(r, 700)); // time for a wrongly sent mail to show up
    expect(mails(who.email).length).toBe(1);
    expect(copies(who.email).length).toBe(1);
  });
});
