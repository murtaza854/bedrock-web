"use client";
import { can, useMe } from "@/lib/auth";

// Shows its children only to a role that has that letter (c create, r read, u update, d delete) in that tab, so a screen
// does not offer buttons the server would refuse. The API enforces it either way.
export function Can({ area, letter = "c", children }: { area: string; letter?: "c" | "r" | "u" | "d"; children: React.ReactNode }) {
  const me = useMe();
  return can(me, area, letter) ? <>{children}</> : null;
}
