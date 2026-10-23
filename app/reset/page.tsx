import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ResetForm } from "./form";

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token)
    return (
      <AuthCard>
        <h1 className="text-2xl font-semibold tracking-tight">Link not valid</h1>
        <p className="text-sm text-muted">This reset link is missing or has expired.</p>
        <Link href="/forgot" className="text-center text-sm text-muted hover:text-ink">Request a new link</Link>
      </AuthCard>
    );
  return <ResetForm token={token} />;
}
