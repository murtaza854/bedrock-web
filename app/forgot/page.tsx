"use client";
import Link from "next/link";
import { useState } from "react";
import { post } from "@/lib/api";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export default function Forgot() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return setError("Enter your email");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address");
    setError("");
    try { await post("/forgot", { email }); } catch { return setError("Could not reach the server, try again"); }
    setSent(email); // the same answer whether or not an account exists
  };
  if (sent)
    return (
      <AuthCard>
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted">If an account exists for <b className="text-ink">{sent}</b>, we sent a link to reset your password. It expires in one hour.</p>
        <Link href="/login" className="text-center text-sm text-muted hover:text-ink">Back to log in</Link>
      </AuthCard>
    );
  return (
    <AuthCard onSubmit={submit}>
      <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
      <p className="mb-2 text-sm text-muted">Enter your email and we'll send you a reset link.</p>
      <Field name="email" type="email" placeholder="Email" autoComplete="username" error={error} />
      <Button>Send reset link</Button>
      <Link href="/login" className="text-center text-sm text-muted hover:text-ink">Back to log in</Link>
    </AuthCard>
  );
}
