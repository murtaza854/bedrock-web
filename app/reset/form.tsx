"use client";
import Link from "next/link";
import { useState } from "react";
import { post } from "@/lib/api";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";

export function ResetForm({ token }: { token: string }) {
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pw = String(f.get("password") ?? ""), again = String(f.get("again") ?? "");
    const err: Errors = {};
    if (!pw) err.password = "Enter a new password";
    else if (pw.length < 12) err.password = "Use at least 12 characters";
    if (!again) err.again = "Repeat the new password";
    else if (pw && again !== pw) err.again = "Passwords don't match";
    setErrors(err);
    if (Object.keys(err).length) return;
    try { await post("/reset", { token, password: pw }); } catch (x) { return setErrors({ password: (x as Error).message || "Could not set the password, try again" }); }
    setDone(true);
  };
  if (done)
    return (
      <AuthCard>
        <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
        <p className="text-sm text-muted">You can now log in with your new password.</p>
        <Link href="/login" className="rounded-md bg-ink px-3.5 py-2 text-center text-sm font-medium text-bg">Log in</Link>
      </AuthCard>
    );
  return (
    <AuthCard onSubmit={submit}>
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mb-2 text-sm text-muted">Use at least 12 characters.</p>
      <Field name="password" type="password" placeholder="New password" autoComplete="new-password" error={errors.password} />
      <Field name="again" type="password" placeholder="Repeat new password" autoComplete="new-password" error={errors.again} />
      <Button>Update password</Button>
    </AuthCard>
  );
}
