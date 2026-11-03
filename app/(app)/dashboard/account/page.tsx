"use client";
import { useEffect, useState } from "react";
import { del, get, post } from "@/lib/api";
import { resetMe, useMe } from "@/lib/auth";
import { ago } from "@/lib/ago";
import { Passkeys } from "@/components/passkey-setup";
import { TwoFactor } from "@/components/two-factor-setup";
import { passwordProblem } from "@/lib/password";
import { cap } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";

const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;
const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="border-t border-line pt-5">
    <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}{note && <span className="ml-3 normal-case tracking-normal">{note}</span>}</h2>
    <div className="mt-4">{children}</div>
  </section>
);
// a rough, human description of a browser from its user-agent string
const device = (ua: string) => {
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const o = /iPhone|iPad/.test(ua) ? "iPhone or iPad" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return o ? `${b} on ${o}` : b;
};

function Password() {
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const el = e.currentTarget, f = Object.fromEntries(new FormData(el)) as Record<string, string>;
    const err: Errors = {};
    if (!f.current) err.current = "Enter your current password";
    if (passwordProblem(f.next)) err.next = passwordProblem(f.next);
    if (f.again !== f.next) err.again = "The two passwords don't match";
    setErrors(err); setDone(false);
    if (Object.keys(err).length) return;
    try { await post("/account/password", { current: f.current, new: f.next }); }
    catch (x) { return setErrors({ form: (x as Error).message }); }
    el.reset(); setDone(true);
  };
  return (
    <form onSubmit={submit} noValidate className="grid max-w-sm gap-3">
      <div><Lbl>Current password</Lbl><Field name="current" type="password" autoComplete="current-password" error={errors.current} /></div>
      <div><Lbl>New password</Lbl><Field name="next" type="password" autoComplete="new-password" error={errors.next} /></div>
      <div><Lbl>New password again</Lbl><Field name="again" type="password" autoComplete="new-password" error={errors.again} /></div>
      <div className="flex items-center gap-3"><Button>Change password</Button>
        {done && <p className="text-sm text-muted">Changed. Your other devices were signed out.</p>}
        {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}</div>
    </form>
  );
}

function Sessions() {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => get("/account/sessions").then(setRows);
  useEffect(() => { load(); }, []);
  if (!rows) return null;
  return (
    <div>
      <ul className="text-sm">{rows.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
          <span><b className="font-medium">{device(s.user_agent)}</b>{s.current && <span className="ml-2"><Badge tone="good">This device</Badge></span>}<span className="block text-xs text-muted">{s.ip || "unknown address"} · active {ago(s.last_seen_at)} · signed in {ago(s.created_at)}</span></span>
          {!s.current && <button onClick={async () => { await del(`/account/sessions/${s.id}`); load(); }} className="text-xs text-muted hover:text-ink">Sign out</button>}
        </li>))}</ul>
      {rows.length > 1 && <button onClick={async () => { await post("/account/sessions/revoke-others", {}); load(); }} className="mt-4 text-sm text-muted underline hover:text-ink">Sign out every other device</button>}
    </div>
  );
}

export default function Account() {
  const me = useMe();
  const [tick, setTick] = useState(0);
  const [fresh, setFresh] = useState<any>(null);
  useEffect(() => { get("/me").then(setFresh); }, [tick]);
  const m = fresh ?? me;
  if (!m) return null;
  return (
    <div className="grid max-w-3xl gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted">{m.email} · <Badge>{cap(m.role)}</Badge></p>
      </div>
      {m.dev ? (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">Login is switched off while you build (<code>DEV_NO_AUTH</code>), so there is no password, two-factor or session to manage. Everyone is treated as an owner. Run the API with <code>make run DEV_NO_AUTH=0</code> to use real accounts.</p>
      ) : (
        <>
          {m.passwords !== false && <Section title="Password"><Password /></Section>}
          {m.passwords !== false && <Section title="Two-factor sign-in (authenticator app)" note={m.passkeys && !m.totp_enabled ? "You have a passkey, which already counts as two-factor. The app is optional." : undefined}><TwoFactor on={m.totp_enabled} reload={() => setTick((t) => t + 1)} /></Section>}
          <Section title="Passkeys" note={m.passwords === false ? `Passwords are turned off. You sign in with a passkey, and you need ${m.passkeys_needed ?? 1}.` : undefined}><Passkeys /></Section>
          <Section title="Where you're signed in"><Sessions /></Section>
        </>
      )}
    </div>
  );
}
