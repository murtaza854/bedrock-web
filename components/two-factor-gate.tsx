"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/auth";

// Until the setup wizard is finished (or two-factor is set up, when the owner requires it), the only page that opens is the wizard.
export function TwoFactorGate({ children }: { children: React.ReactNode }) {
  const me = useMe(), router = useRouter();
  const gated = !!me?.must_setup_2fa;
  useEffect(() => { if (gated) router.replace("/onboarding"); }, [gated, router]);
  return gated ? null : <>{children}</>;
}
