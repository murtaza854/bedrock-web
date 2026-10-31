"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/lib/auth";

// When the owner requires two-factor and this person has not turned it on, the only page that opens is Account, where they do.
export function TwoFactorGate({ children }: { children: React.ReactNode }) {
  const me = useMe(), path = usePathname(), router = useRouter();
  const gated = !!me?.must_setup_2fa && path !== "/dashboard/account";
  useEffect(() => { if (gated) router.replace("/dashboard/account"); }, [gated, router]);
  return gated ? null : <>{children}</>;
}
