import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { WelcomeForm } from "./form";

export default async function Welcome({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token)
    return (
      <AuthCard>
        <h1 className="text-2xl font-semibold tracking-tight">Invitation not valid</h1>
        <p className="text-sm text-muted">This link is missing or has expired. Ask the person who invited you for a new one.</p>
        <Link href="/login" className="text-center text-sm text-muted hover:text-ink">Log in</Link>
      </AuthCard>
    );
  return <WelcomeForm token={token} />;
}
