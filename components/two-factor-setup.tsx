"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { post } from "@/lib/api";
import { resetMe } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";

const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;

// Set up (and later manage) the authenticator app. Shared by Account and the setup wizard.
export function TwoFactor({ on, reload, onCodes }: { on: boolean; reload: () => void; onCodes?: (shown: boolean) => void }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [qr, setQr] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"off" | "codes" | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { onCodes?.(!!codes); }, [codes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (setup) QRCode.toDataURL(setup.uri, { margin: 1, width: 180 }).then(setQr); else setQr(""); }, [setup]);

  const start = async () => { setErrors({}); try { setSetup(await post("/account/2fa/setup", {})); } catch (x) { setErrors({ form: (x as Error).message }); } };
  const enable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const code = String(f.get("code") ?? "").trim(), code2 = String(f.get("code2") ?? "").trim();
    if (!code) return setErrors({ code: "Enter the 6-digit code from your app" });
    if (!code2) return setErrors({ code2: "Wait for the code to change, then enter the new one" });
    try { const r = await post("/account/2fa/enable", { code, code2 }); setCodes(r.backup_codes); setSetup(null); setErrors({}); resetMe(); reload(); }
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
        <p className="text-sm">1. Scan this code with your authenticator app.<br />2. Enter the 6-digit code it shows.<br />3. Wait about 30 seconds until the code changes, then enter the new one.</p>
        <p className="break-all text-xs text-muted">Can't scan? Type this key in: <span className="select-all font-mono text-ink">{setup.secret.match(/.{1,4}/g)?.join(" ")}</span></p>
        <Field name="code" placeholder="First code" inputMode="numeric" autoComplete="one-time-code" error={errors.code} autoFocus />
        <Field name="code2" placeholder="Next code" inputMode="numeric" autoComplete="off" error={errors.code2} />
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
