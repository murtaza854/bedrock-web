"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Book, MapIcon, Check, Gauge, Logout, People, Shield, Sliders, Tag, User, Overview, Panel, Plots } from "./icons";
import { can, useMe } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { ThemeToggle } from "./theme-toggle";

type L = { href: string; label: string; icon: React.ReactNode; area: string; exact?: boolean };
const LINKS: L[] = [
  { href: "/dashboard", label: "Overview", icon: <Overview />, area: "plots", exact: true },
  { href: "/dashboard/tasks", label: "Tasks", icon: <Check />, area: "tasks" },
  { href: "/dashboard/plots", label: "Plots", icon: <Plots />, area: "plots" },
  { href: "/dashboard/map", label: "Map", icon: <MapIcon />, area: "map" },
  { href: "/dashboard/offers", label: "Offers", icon: <Tag />, area: "offers" },
  { href: "/dashboard/contacts", label: "Contacts", icon: <People />, area: "contacts" },
  { href: "/dashboard/bylaws", label: "Bylaws", icon: <Book />, area: "bylaws" },
  { href: "/dashboard/scorecard", label: "Scorecard", icon: <Gauge />, area: "scorecard" },
  { href: "/dashboard/settings", label: "Settings", icon: <Sliders />, area: "settings" },
  { href: "/dashboard/admin", label: "Admin", icon: <Shield />, area: "admin" },
];

export function Sidebar() {
  const path = usePathname();
  const me = useMe();
  const cfg = useSettings();
  const [collapsed, setCollapsed] = useState(false); // desktop only: the narrow icon rail
  const [open, setOpen] = useState(false); // phones: the menu slides over the page
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { try { setCollapsed(localStorage.getItem("sidebar") === "1"); } catch {} }, []);
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem("sidebar", c ? "0" : "1"); } catch {}
    return !c;
  });
  const item = "flex items-center gap-3 rounded-md px-3 py-2 text-sm";
  const hide = collapsed ? "md:hidden" : ""; // labels vanish in the desktop rail, never on a phone
  const centre = collapsed ? "md:justify-center" : "";
  return (
    <>
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg px-4 py-2.5 md:hidden print:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-2 text-muted hover:bg-line/50 hover:text-ink"><Panel /></button>
        <span className="text-lg font-semibold tracking-tight">Bedrock</span>
      </div>
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/30 md:hidden" />}
      <aside className={`print:hidden fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-line bg-bg p-3 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:shrink-0 md:translate-x-0 md:overflow-visible md:bg-transparent md:transition-[width] ${open ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "md:w-16" : "md:w-56"}`}>
        <div className="flex items-center justify-between px-1 py-1">
          <span className={`min-w-0 pl-2 ${hide}`}><span className="block text-lg font-semibold tracking-tight">Bedrock</span>{cfg.project_name && <span className="block truncate text-xs text-muted">{cfg.project_name}</span>}</span>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-2 text-muted hover:bg-line/50 hover:text-ink md:hidden"><Panel /></button>
          <button onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label="Toggle sidebar"
            className={`hidden rounded-md p-2 text-muted hover:bg-line/50 hover:text-ink md:block ${collapsed ? "mx-auto" : ""}`}><Panel /></button>
        </div>
        <nav className="mt-6 grid min-h-0 gap-1 overflow-y-auto">
          {LINKS.filter((l) => can(me, l.area)).map((l) => {
            const active = l.exact ? path === l.href : path === l.href || path.startsWith(l.href + "/");
            return (
              <Link key={l.href} href={l.href} title={collapsed ? l.label : undefined} aria-current={active ? "page" : undefined}
                className={`${item} ${active ? "bg-line text-ink" : "text-muted hover:bg-line/50 hover:text-ink"} ${centre}`}>
                {l.icon}<span className={hide}>{l.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-2 pt-4">
          <ThemeToggle compact={collapsed} />
          <Link href="/dashboard/account" title={collapsed ? "Account" : undefined} aria-current={path === "/dashboard/account" ? "page" : undefined}
            className={`${item} ${path === "/dashboard/account" ? "bg-line text-ink" : "text-muted hover:bg-line/50 hover:text-ink"} ${centre}`}>
            <User /><span className={`min-w-0 ${hide}`}><span className="block">Account</span>{me && <span className="block truncate text-[11px] opacity-70">{me.email}</span>}</span>
          </Link>
          <Link href="/logout" title={collapsed ? "Log out" : undefined}
            className={`${item} text-muted hover:bg-line/50 hover:text-ink ${centre}`}>
            <Logout /><span className={hide}>Log out</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
