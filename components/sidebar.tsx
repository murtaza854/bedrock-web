"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Book, MapIcon, Check, Gauge, Logout, People, Shield, Sliders, Tag, User, Overview, Panel, Plots } from "./icons";
import { canSeeMoney, useMe } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { ThemeToggle } from "./theme-toggle";

type L = { href: string; label: string; icon: React.ReactNode; exact?: boolean; money?: boolean; owner?: boolean };
const LINKS: L[] = [
  { href: "/dashboard", label: "Overview", icon: <Overview />, exact: true },
  { href: "/dashboard/tasks", label: "Tasks", icon: <Check /> },
  { href: "/dashboard/plots", label: "Plots", icon: <Plots /> },
  { href: "/dashboard/map", label: "Map", icon: <MapIcon /> },
  { money: true, href: "/dashboard/offers", label: "Offers", icon: <Tag /> },
  { href: "/dashboard/contacts", label: "Contacts", icon: <People /> },
  { href: "/dashboard/bylaws", label: "Bylaws", icon: <Book /> },
  { href: "/dashboard/scorecard", label: "Scorecard", icon: <Gauge /> },
  { href: "/dashboard/settings", label: "Settings", icon: <Sliders /> },
  { owner: true, href: "/dashboard/admin", label: "Admin", icon: <Shield /> },
];

export function Sidebar() {
  const path = usePathname();
  const me = useMe();
  const cfg = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("sidebar") === "1"); } catch {} }, []);
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem("sidebar", c ? "0" : "1"); } catch {}
    return !c;
  });
  const item = "flex items-center gap-3 rounded-md px-3 py-2 text-sm";
  return (
    <aside className={`print:hidden sticky top-0 flex h-screen shrink-0 flex-col border-r border-line p-3 transition-[width] duration-200 ${collapsed ? "w-16" : "w-56"}`}>
      <div className="flex items-center justify-between px-1 py-1">
        {!collapsed && <span className="min-w-0 pl-2"><span className="block text-lg font-semibold tracking-tight">Bedrock</span>{cfg.project_name && <span className="block truncate text-xs text-muted">{cfg.project_name}</span>}</span>}
        <button onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label="Toggle sidebar"
          className={`rounded-md p-2 text-muted hover:bg-line/50 hover:text-ink ${collapsed ? "mx-auto" : ""}`}><Panel /></button>
      </div>
      <nav className="mt-6 grid min-h-0 gap-1 overflow-y-auto">
        {LINKS.filter((l) => (!l.money || canSeeMoney(me?.role)) && (!l.owner || me?.role === "owner")).map((l) => {
          const active = l.exact ? path === l.href : path === l.href || path.startsWith(l.href + "/");
          return (
            <Link key={l.href} href={l.href} title={collapsed ? l.label : undefined} aria-current={active ? "page" : undefined}
              className={`${item} ${active ? "bg-line text-ink" : "text-muted hover:bg-line/50 hover:text-ink"} ${collapsed ? "justify-center" : ""}`}>
              {l.icon}{!collapsed && l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto grid gap-2">
        <ThemeToggle compact={collapsed} />
        <Link href="/dashboard/account" title={collapsed ? "Account" : undefined} aria-current={path === "/dashboard/account" ? "page" : undefined}
          className={`${item} ${path === "/dashboard/account" ? "bg-line text-ink" : "text-muted hover:bg-line/50 hover:text-ink"} ${collapsed ? "justify-center" : ""}`}>
          <User />{!collapsed && <span className="min-w-0"><span className="block">Account</span>{me && <span className="block truncate text-[11px] opacity-70">{me.email}</span>}</span>}
        </Link>
        <Link href="/logout" title={collapsed ? "Log out" : undefined}
          className={`${item} text-muted hover:bg-line/50 hover:text-ink ${collapsed ? "justify-center" : ""}`}>
          <Logout />{!collapsed && "Log out"}
        </Link>
      </div>
    </aside>
  );
}
