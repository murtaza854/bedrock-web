"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { resetMe } from "@/lib/auth";
import { passwordProblem } from "@/lib/password";
import { passkeysSupported, signUpWithPasskey } from "@/lib/passkey";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";

// Step 1 of 3 of getting started: choose a password. Step 2 (a passkey or the authenticator app) is the setup wizard, which is the only page that opens until they finish.
export function WelcomeForm({ token }: { token: string }) {
  const router = useRouter();
  const [who, setWho] = useState<{ email: string; name: string; passwords?: boolean } | null>(null);
  const [bad, setBad] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => { post("/invite/lookup", { token }).then(setWho).catch((x) => setBad((x as Error).message)); }, [token]);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pw = String(f.get("password") ?? ""), again = String(f.get("again") ?? "");
    const err: Errors = {};
    if (!pw) err.password = "Choose a password";
    else if (passwordProblem(pw)) err.password = passwordProblem(pw);
    if (!again) err.again = "Repeat the password";
    else if (pw && again !== pw) err.again = "Passwords don't match";
    setErrors(err);
    if (Object.keys(err).length) return;
    try { await post("/invite/accept", { token, password: pw }); } catch (x) { return setErrors({ password: (x as Error).message || "Could not set the password, try again" }); }
    resetMe();
    router.replace("/onboarding");
  };
  if (bad)
    return (
      <AuthCard>
        <h1 className="text-2xl font-semibold tracking-tight">Invitation not valid</h1>
        <p className="text-sm text-muted">{bad}</p>
        <Link href="/login" className="text-center text-sm text-muted hover:text-ink">Log in</Link>
      </AuthCard>
    );
  if (!who) return <AuthCard><p className="text-sm text-muted">Checking your invitation…</p></AuthCard>;
  if (who.passwords === false) { // passwords are off: the first passkey takes the place of a password
    const make = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const m = await signUpWithPasskey(token, String(new FormData(e.currentTarget).get("name") ?? "").trim());
      if (m) return setErrors({ password: m });
      resetMe();
      router.replace("/onboarding");
    };
    return (
      <AuthCard onSubmit={make}>
        <p className="text-xs text-muted">Step 1 of 3</p>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Bedrock</h1>
        <p className="mb-2 text-sm text-muted">You sign in to Bedrock with a passkey for {who.email}: your fingerprint, face or device PIN. There is no password. Make your first one now.</p>
        {passkeysSupported() ? <><Field name="name" placeholder="Name, e.g. MacBook" error={errors.password} /><Button>Set up a passkey</Button></> : <p className="text-sm text-muted">This browser can&apos;t make passkeys. Open this link in a recent Chrome, Safari or Firefox.</p>}
      </AuthCard>
    );
  }
  return (
    <AuthCard onSubmit={submit}>
      <p className="text-xs text-muted">Step 1 of 3</p>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to Bedrock</h1>
      <p className="mb-2 text-sm text-muted">Choose a password for {who.email}: at least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol. Use something you don&apos;t use anywhere else. Next you&apos;ll turn on two-factor sign-in.</p>
      <Field name="password" type="password" placeholder="Password" autoComplete="new-password" error={errors.password} />
      <Field name="again" type="password" placeholder="Repeat password" autoComplete="new-password" error={errors.again} />
      <Button>Continue</Button>
    </AuthCard>
  );
}
