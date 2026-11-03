import { API, post } from "./api";

// Passkeys use the browser's own WebAuthn JSON helpers (Chrome 129, Safari 18.4, Firefox 119 and newer).
type PK = { parseCreationOptionsFromJSON(o: unknown): PublicKeyCredentialCreationOptions; parseRequestOptionsFromJSON(o: unknown): PublicKeyCredentialRequestOptions };
const pk = () => (typeof window === "undefined" ? undefined : (window.PublicKeyCredential as unknown as PK | undefined));
export const passkeysSupported = () => !!pk()?.parseCreationOptionsFromJSON && !!navigator.credentials;

export async function addPasskey(name: string) {
  const opts = await post("/account/passkeys/begin", {});
  const cred = (await navigator.credentials.create({ publicKey: pk()!.parseCreationOptionsFromJSON(opts.publicKey) })) as PublicKeyCredential | null;
  if (!cred) throw new Error("No passkey was created");
  await post(`/account/passkeys/finish?name=${encodeURIComponent(name)}`, cred.toJSON());
}

// Returns an error message, or "" when signed in. (Not through `post`: a refused sign-in must not bounce the page to /login.)
export async function signInWithPasskey(): Promise<string> {
  const send = (p: string, b: unknown) => fetch(API + p, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).catch(() => null);
  const begin = await send("/login/passkey/begin", {});
  if (!begin?.ok) return !begin ? "Can't reach the server" : begin.status === 429 ? (await begin.text()).trim() : "Could not start";
  const { id, options } = await begin.json();
  let cred: PublicKeyCredential | null;
  try { cred = (await navigator.credentials.get({ publicKey: pk()!.parseRequestOptionsFromJSON(options.publicKey) })) as PublicKeyCredential | null; } catch { return "No passkey was used"; }
  if (!cred) return "No passkey was used";
  const done = await send(`/login/passkey/finish?id=${encodeURIComponent(id)}`, cred.toJSON());
  return done?.ok ? "" : !done ? "Can't reach the server" : done.status === 429 ? (await done.text()).trim() : "That passkey was not accepted";
}

// From an invitation link, when passwords are off: make the first passkey instead of choosing a password. This signs the person in.
// Returns an error message, or "" when it worked.
export async function signUpWithPasskey(token: string, name: string): Promise<string> {
  const send = (p: string, b: unknown) => fetch(API + p, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).catch(() => null);
  const begin = await send("/invite/passkey/begin", { token });
  if (!begin?.ok) return !begin ? "Can't reach the server" : (await begin.text()).trim() || "Could not start";
  const opts = await begin.json();
  let cred: PublicKeyCredential | null;
  try { cred = (await navigator.credentials.create({ publicKey: pk()!.parseCreationOptionsFromJSON(opts.publicKey) })) as PublicKeyCredential | null; } catch { return "No passkey was created"; }
  if (!cred) return "No passkey was created";
  const done = await send(`/invite/passkey/finish?token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}`, cred.toJSON());
  return done?.ok ? "" : !done ? "Can't reach the server" : (await done.text()).trim() || "That passkey could not be added";
}
