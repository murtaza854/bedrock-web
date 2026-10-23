"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { get, post } from "@/lib/api";
import { ROLES, ago, dueState } from "@/lib/contacts";
import { cap } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Due } from "@/components/followup-due";

const Kpi = ({ k, v, sub }: { k: string; v: number; sub?: string }) => (
  <div><p className="text-xs text-muted">{k}</p><p className="mt-1.5 text-3xl font-light tracking-tight">{v}</p><p className="mt-1 min-h-4 text-xs text-muted">{sub}</p></div>
);

export default function Contacts() {
  const [list, setList] = useState<any[] | null>(null);
  const [follow, setFollow] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const load = () => { get("/contacts").then(setList); get("/followups").then(setFollow); };
  useEffect(load, []);

  const shown = useMemo(() => (list ?? []).filter((c) => (role === "all" || c.roles.includes(role)) &&
    `${c.name} ${c.company} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase())), [list, q, role]);
  const done = async (id: number) => { await post(`/log/${id}/done`, {}); load(); };

  if (!list) return null;
  const brokers = list.filter((c) => c.roles.includes("broker"));
  const due = follow.filter((f) => dueState(f.followup_on) !== "later");
  return (
    <div className="grid gap-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm text-muted">Brokers, owners, lawyers and everyone else you deal with.</p>
        </div>
        <Link href="/dashboard/contacts/new" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90">Add contact</Link>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <Kpi k="Contacts" v={list.length} />
        <Kpi k="Brokers" v={brokers.length} sub={`${brokers.filter((b) => !b.mandate_verified).length} without a verified mandate`} />
        <Kpi k="Follow-ups due" v={due.length} sub={`${follow.length} open in total`} />
        <Kpi k="Not contacted in 30 days" v={list.filter((c) => !c.last_contact || Date.now() - new Date(c.last_contact).getTime() > 30 * 86400000).length} />
      </div>

      {follow.length > 0 && (
        <section className="border-t border-line pt-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Follow-ups</h2>
          <ul className="mt-4 text-sm">
            {follow.slice(0, 8).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <span className="min-w-0 truncate"><Link href={`/dashboard/contacts/${f.party_id}`} className="font-medium">{f.contact_name}</Link>
                  <span className="ml-3 text-muted">{f.summary}{f.plot_label && ` · ${f.plot_label}`}</span></span>
                <span className="flex shrink-0 items-center gap-4"><Due on={f.followup_on} /><button onClick={() => done(f.id)} className="text-xs text-muted hover:text-ink">Done</button></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-line pt-5">
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Input className="max-w-64" placeholder="Search name, company, phone" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-1 text-sm">
            {["all", ...ROLES].map((r) => (
              <button key={r} onClick={() => setRole(r)} aria-pressed={role === r}
                className={`rounded-md px-3 py-1.5 ${role === r ? "bg-line text-ink" : "text-muted hover:text-ink"}`}>{cap(r)}</button>
            ))}
          </div>
        </div>
        {shown.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Name</th><th className="pb-2 text-left font-normal">Roles</th><th className="pb-2 text-left font-normal">Phone</th><th className="pb-2 text-right font-normal">Last contact</th><th className="pb-2 pl-6 text-right font-normal">Follow-up</th></tr></thead>
            <tbody>{shown.map((c) => (
              <tr key={c.id} className="border-t border-line hover:bg-line/30">
                <td className="py-3"><Link href={`/dashboard/contacts/${c.id}`} className="font-medium">{c.name}</Link>{c.company && <p className="text-xs text-muted">{c.company}</p>}</td>
                <td><span className="flex flex-wrap gap-1">{c.roles.map((r: string) => <Badge key={r}>{cap(r)}</Badge>)}
                  {c.roles.includes("broker") && <Badge tone={c.mandate_verified ? "good" : "warn"}>{c.mandate_verified ? "Mandate verified" : "Mandate unverified"}</Badge>}</span></td>
                <td className="text-muted">{c.phone || "-"}</td>
                <td className="text-right text-muted">{ago(c.last_contact)}</td>
                <td className="pl-6 text-right">{c.open_followups ? <Badge tone="info">{c.open_followups} open</Badge> : <span className="text-muted">-</span>}</td>
              </tr>))}</tbody>
          </table>
        ) : <p className="py-6 text-sm text-muted">{list.length ? "No contacts match." : "No contacts yet. Add your first broker or owner."}</p>}
      </section>
    </div>
  );
}
