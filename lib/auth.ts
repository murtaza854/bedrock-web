"use client";
import { useEffect, useState } from "react";
import { get } from "./api";

export type Me = { email: string; role: string; perms: Record<string, string>; name: string; first_name?: string; last_name?: string; totp_enabled: boolean; passkeys?: number; passkeys_needed?: number; passwords?: boolean; must_setup_2fa?: boolean; onboarding?: boolean; dev: boolean };

let cached: Promise<Me> | null = null;
export const loadMe = () => (cached ??= get("/me").catch((e) => { cached = null; throw e; }));
const watchers = new Set<() => void>();
// forget what we know about the person and let every screen that shows it ask again (after two-factor is turned on, say)
export const resetMe = () => { cached = null; watchers.forEach((f) => f()); };
export function useMe(): Me | null {
  const [m, setM] = useState<Me | null>(null);
  useEffect(() => {
    const ask = () => { loadMe().then(setM).catch(() => {}); };
    ask(); watchers.add(ask);
    return () => { watchers.delete(ask); };
  }, []);
  return m;
}
// What the person's role may do in each tab: the letters c create, r read, u update, d delete. The API enforces it;
// the screens use this so they don't offer what the server would refuse.
export const can = (me: Me | null | undefined, area: string, letter: "c" | "r" | "u" | "d" = "r") => !!me?.perms?.[area]?.includes(letter);
