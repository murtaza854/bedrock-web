"use client";
import { useEffect, useState } from "react";
import { get } from "./api";

export type Me = { email: string; role: string; perms: Record<string, string>; name: string; totp_enabled: boolean; dev: boolean };

let cached: Promise<Me> | null = null;
export const loadMe = () => (cached ??= get("/me").catch((e) => { cached = null; throw e; }));
export const resetMe = () => { cached = null; };
export function useMe(): Me | null {
  const [m, setM] = useState<Me | null>(null);
  useEffect(() => { loadMe().then(setM).catch(() => {}); }, []);
  return m;
}
// What the person's role may do in each tab: the letters c create, r read, u update, d delete. The API enforces it;
// the screens use this so they don't offer what the server would refuse.
export const can = (me: Me | null | undefined, area: string, letter: "c" | "r" | "u" | "d" = "r") => !!me?.perms?.[area]?.includes(letter);
