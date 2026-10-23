"use client";
import { useState } from "react";
import { API } from "@/lib/api";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

type Errors = { email?: string; password?: string; form?: string };

export default function Login() {
  const [errors, setErrors] = useState<Errors>({});
  const [challenge, setChallenge] = useState<string | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as { email: string; password: string };
    const next: Errors = {};
    if (!f.email.trim()) next.email = "Enter your email";
    else if (!/^\S+@\S+\.\S+$/.test(f.email)) next.email = "Enter a valid email address";
    if (!f.password) next.password = "Enter your password";
    setErrors(next);
    if (Object.keys(next).length) return;
    const r = await fetch(API + "/login", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    }).catch(() => null);
    if (r?.status === 200) { const j = await r.json(); if (j.needs_2fa) { setErrors({}); return setChallenge(j.challenge); } }
    if (r?.ok) location.href = "/dashboard";
    else setErrors({ form: !r ? "Can't reach the server" : r.status === 401 ? "Wrong email or password" : r.status === 429 ? (await r.text()).trim() : "Login failed" });
  };
  const verify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    if (!code) return setErrors({ form: "Enter the code from your authenticator app" });
    const r = await fetch(API + "/login/2fa", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge, code }) }).catch(() => null);
    if (r?.ok) location.href = "/dashboard";
    else setErrors({ form: !r ? "Can't reach the server" : (await r.text()).trim() || "That code is not right" });
  };
  if (challenge) return (
    <AuthCard onSubmit={verify}>
      <h1 className="text-2xl font-semibold tracking-tight">Check your app</h1>
      <p className="mb-2 text-sm text-muted">Enter the 6-digit code from your authenticator app. Lost your phone? Use one of your backup codes instead.</p>
      <Field name="code" placeholder="123456" autoComplete="one-time-code" inputMode="text" autoFocus error={errors.form} />
      <Button>Verify</Button>
      <button type="button" onClick={() => { setChallenge(null); setErrors({}); }} className="text-center text-sm text-muted hover:text-ink">Back to log in</button>
    </AuthCard>
  );
  return (
    <AuthCard onSubmit={submit}>
      <h1 className="text-2xl font-semibold tracking-tight">Bedrock</h1>
      <p className="mb-2 text-sm text-muted">Verified ground for every decision.</p>
      <Field name="email" type="email" placeholder="Email" autoComplete="username" error={errors.email} />
      <Field name="password" type="password" placeholder="Password" autoComplete="current-password" error={errors.password} />
      <Button>Log in</Button>
      {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}
      <Link href="/forgot" className="text-center text-sm text-muted hover:text-ink">Forgot password?</Link>
    </AuthCard>
  );
}
