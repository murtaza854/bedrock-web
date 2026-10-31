"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { del, get, post } from "@/lib/api";
import { resetMe, useMe } from "@/lib/auth";
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
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

function Password() {
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const el = e.currentTarget, f = Object.fromEntries(new FormData(el)) as Record<string, string>;
    const err: Errors = {};
    if (!f.current) err.current = "Enter your current password";
    if (f.next.length < 12) err.next = "Use at least 12 characters";
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

function TwoFactor({ on, reload }: { on: boolean; reload: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [qr, setQr] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"off" | "codes" | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { if (setup) QRCode.toDataURL(setup.uri, { margin: 1, width: 180 }).then(setQr); else setQr(""); }, [setup]);

  const start = async () => { setErrors({}); try { setSetup(await post("/account/2fa/setup", {})); } catch (x) { setErrors({ form: (x as Error).message }); } };
  const enable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    if (!code) return setErrors({ code: "Enter the 6-digit code from your app" });
    try { const r = await post("/account/2fa/enable", { code }); setCodes(r.backup_codes); setSetup(null); setErrors({}); resetMe(); reload(); }
    catch (x) { setErrors({ code: (x as Error).message }); }
  };
  const turnOff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!f.password || !f.code) return setErrors({ form: "Enter your password and a code from your app" });
    try { await post("/account/2fa/disable", f); setMode(null); setErrors({}); resetMe(); reload(); } catch (x) { setErrors({ form: (x as Error).message }); }
  };
  const renew = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (!password) return setErrors({ form: "Enter your password" });
    try { const r = await post("/account/2fa/backup-codes", { password }); setCodes(r.backup_codes); setMode(null); setErrors({}); } catch (x) { setErrors({ form: (x as Error).message }); }
  };

  if (codes) return (
    <div className="max-w-md">
      <p className="text-sm"><b className="font-medium">Save these backup codes now.</b> Each works once if you lose your phone. They are shown only this one time.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-line/40 p-4 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className="mt-4 flex gap-3">
        <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>Copy</Button>
        <Button onClick={() => { setCodes(null); reload(); }}>I have saved them</Button>
      </div>
    </div>
  );
  if (!on && !setup) return (
    <div>
      <p className="max-w-lg text-sm text-muted">Adds a second step when you sign in: a 6-digit code from an app on your phone (Google Authenticator, Authy, 1Password). A stolen password alone then isn't enough.</p>
      <Button className="mt-4" onClick={start}>Set up two-factor</Button>
      {errors.form && <p role="alert" className="mt-2 text-sm text-red-500">{errors.form}</p>}
    </div>
  );
  if (setup) return (
    <div className="grid max-w-xl gap-5 sm:grid-cols-[180px_1fr]">
      {qr ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={qr} alt="QR code to scan with your authenticator app" className="size-[180px] rounded-lg bg-white" /> : <div className="size-[180px]" />}
      <form onSubmit={enable} noValidate className="grid content-start gap-3">
        <p className="text-sm">1. Scan this code with your authenticator app.<br />2. Enter the 6-digit code it shows.</p>
        <p className="break-all text-xs text-muted">Can't scan? Type this key in: <span className="select-all font-mono text-ink">{setup.secret.match(/.{1,4}/g)?.join(" ")}</span></p>
        <Field name="code" placeholder="123456" inputMode="numeric" autoComplete="one-time-code" error={errors.code} autoFocus />
        <div className="flex gap-3"><Button>Turn on</Button><button type="button" onClick={() => setSetup(null)} className="text-sm text-muted hover:text-ink">Cancel</button></div>
      </form>
    </div>
  );
  return (
    <div>
      <p className="text-sm"><Badge tone="good">On</Badge><span className="ml-3 text-muted">You'll be asked for a code each time you sign in.</span></p>
      <div className="mt-4 flex gap-5 text-sm text-muted"><button onClick={() => { setErrors({}); setMode(mode === "codes" ? null : "codes"); }} className="hover:text-ink">New backup codes</button><button onClick={() => { setErrors({}); setMode(mode === "off" ? null : "off"); }} className="hover:text-ink">Turn off</button></div>
      {mode === "codes" && <form onSubmit={renew} noValidate className="mt-4 grid max-w-sm gap-3"><div><Lbl>Your password</Lbl><Field name="password" type="password" autoComplete="current-password" autoFocus /></div><div><Button>Make new codes</Button></div><p className="text-xs text-muted">The old codes stop working.</p></form>}
      {mode === "off" && <form onSubmit={turnOff} noValidate className="mt-4 grid max-w-sm gap-3"><div><Lbl>Your password</Lbl><Field name="password" type="password" autoComplete="current-password" autoFocus /></div><div><Lbl>A code from your app</Lbl><Field name="code" inputMode="numeric" autoComplete="one-time-code" /></div><div><Button>Turn off two-factor</Button></div></form>}
      {errors.form && <p role="alert" className="mt-3 text-sm text-red-500">{errors.form}</p>}
    </div>
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
      {m.must_setup_2fa && <p role="status" className="rounded-xl bg-line/40 px-5 py-4 text-sm"><b className="font-medium">{m.onboarding ? "Step 2 of 3: " : ""}Turn on two-factor sign-in to continue.</b> {m.onboarding ? "Scan the code below with an authenticator app, then enter the 6-digit code it shows. Step 3 is saving your backup codes." : "Bedrock requires it for everyone. Set it up below with an authenticator app, and keep the backup codes somewhere safe."}</p>}
      {m.dev ? (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">Login is switched off while you build (<code>DEV_NO_AUTH</code>), so there is no password, two-factor or session to manage. Everyone is treated as an owner. Run the API with <code>make run DEV_NO_AUTH=0</code> to use real accounts.</p>
      ) : (
        <>
          <Section title="Password"><Password /></Section>
          <Section title="Two-factor sign-in"><TwoFactor on={m.totp_enabled} reload={() => setTick((t) => t + 1)} /></Section>
          <Section title="Where you're signed in"><Sessions /></Section>
        </>
      )}
    </div>
  );
}
