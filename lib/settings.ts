"use client";
import { useEffect, useState } from "react";
import { get } from "./api";

export type Settings = {
  project_name: string; default_profile: number | null; spread_alert_pct: number; stale_quote_days: number;
  offer_warn_days: number; min_sample: number; anchor_stale_days: number;
};
// the same defaults the API uses, so screens look right before the real values arrive
export const DEFAULTS: Settings = { project_name: "", default_profile: null, spread_alert_pct: 10, stale_quote_days: 30, offer_warn_days: 7, min_sample: 3, anchor_stale_days: 180 };

let current: Settings = DEFAULTS;
let started = false;
const subs = new Set<() => void>();

export const getSettings = () => current;
export function reloadSettings() {
  started = true;
  return get("/settings").then((r) => { current = { ...DEFAULTS, ...r.values }; subs.forEach((f) => f()); }).catch(() => {});
}
export function useSettings(): Settings {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    if (!started) reloadSettings();
    return () => { subs.delete(f); };
  }, []);
  return current;
}
