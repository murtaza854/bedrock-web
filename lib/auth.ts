"use client";
import { useEffect, useState } from "react";
import { get } from "./api";

export type Me = { email: string; role: string; name: string; totp_enabled: boolean; dev: boolean };

let cached: Promise<Me> | null = null;
export const loadMe = () => (cached ??= get("/me").catch((e) => { cached = null; throw e; }));
export const resetMe = () => { cached = null; };
export function useMe(): Me | null {
  const [m, setM] = useState<Me | null>(null);
  useEffect(() => { loadMe().then(setM).catch(() => {}); }, []);
  return m;
}
// mirrors the API's rules, so the screens don't offer what the server would refuse. The API is what enforces them.
export const canSeeMoney = (role?: string) => role === "owner" || role === "editor";
export const canWrite = (role?: string) => role === "owner" || role === "editor";
export const ROLES = [
  { value: "owner", label: "Owner", note: "Everything, including users, the audit log and backups." },
  { value: "editor", label: "Editor", note: "Everything except administration." },
  { value: "viewer", label: "Viewer", note: "Read only. No offers, financials or document files." },
];
