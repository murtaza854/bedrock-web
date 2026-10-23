"use client";
import { useEffect } from "react";
import { post } from "@/lib/api";

export default function Logout() {
  useEffect(() => { post("/logout", {}).catch(() => {}).finally(() => { location.href = "/login"; }); }, []);
  return null;
}
