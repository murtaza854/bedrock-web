"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { get, post, put } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { cap } from "@/lib/plots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AREAS: Record<string, string> = { plots: "Plots, quotes and facts", feasibility: "Feasibility", offers: "Offers and purchases", rates: "Tax and fee rates", contacts: "Contacts", tasks: "Tasks", map: "Map", bylaws: "Bylaws", scorecard: "Scorecard", settings: "Settings", admin: "Admin" };
const LETTERS: [string, string][] = [["c", "Create"], ["r", "Read"], ["u", "Update"], ["d", "Delete"]];
const BACK = "/dashboard/admin?tab=roles";

// One page for making a role (/roles/new), changing one, or looking at a built-in one.
export default function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const me = useMe();
  const router = useRouter();
  const [areas, setAreas] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [builtin, setBuiltin] = useState(false);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    get("/admin/roles").then((d) => {
      setAreas(d.areas);
      const r = d.roles.find((x: any) => String(x.id) === id);
      setPerms(r ? { ...r.perms } : Object.fromEntries(d.areas.map((a: string) => [a, ""])));
      if (r) { setName(r.name); setBuiltin(r.builtin); }
      setReady(true);
    }).catch((x) => setErr((x as Error).message));
  }, [id]);
  if (me && !can(me, "admin")) return <p className="text-sm text-muted">Your role cannot open this page.</p>;
  const locked = builtin || me?.role !== "owner";
  // Read comes with anything else, and taking Read away takes the rest with it
  const toggle = (a: string, l: string) => setPerms((p) => {
    const has = (p[a] ?? "").includes(l);
    let next = LETTERS.map(([k]) => k).filter((k) => (k === l ? !has : (p[a] ?? "").includes(k))).join("");
    if (l !== "r" && !has && !next.includes("r")) next = "r" + next;
    if (l === "r" && has) next = "";
    return { ...p, [a]: next };
  });
  const save = async () => {
    setErr("");
    try { await (isNew ? post("/admin/roles", { name, perms }) : put(`/admin/roles/${id}`, { name, perms })); router.push(BACK); }
    catch (x) { setErr((x as Error).message); }
  };
  const title = isNew ? "New role" : builtin ? `${cap(name)}, built in` : locked ? cap(name) : `Edit ${name}`;
  return (
    <div className="grid gap-6">
      <div>
        <Link href={BACK} className="text-sm text-muted hover:text-ink">← Roles</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">For each tab, what a person with this role may create, read, update and delete. A role change signs the person out so it applies straight away.</p>
      </div>
      {ready && (
        <>
          {!builtin && <div className="max-w-xs"><p className="mb-1.5 text-xs text-muted">Name</p><Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Role name" maxLength={40} placeholder="e.g. Analyst" disabled={locked} /></div>}
          <table className="w-full max-w-xl text-sm">
            <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Tab</th>{LETTERS.map(([k, n]) => <th key={k} className="pb-2 text-center font-normal">{n}</th>)}</tr></thead>
            <tbody>{areas.map((a) => (
              <tr key={a} className="border-t border-line"><td className="py-2.5">{AREAS[a] ?? a}</td>
                {LETTERS.map(([k, n]) => <td key={k} className="text-center"><input type="checkbox" className="size-4 accent-[var(--accent)]" aria-label={`${AREAS[a] ?? a} ${n}`} checked={(perms[a] ?? "").includes(k)} disabled={locked} onChange={() => toggle(a, k)} /></td>)}</tr>))}</tbody>
          </table>
        </>)}
      {err && <p role="alert" className="text-sm text-red-500">{err}</p>}
      <div className="flex gap-2">
        {!locked && <Button onClick={save}>{isNew ? "Create role" : "Save role"}</Button>}
        <Button variant="ghost" onClick={() => router.push(BACK)}>{locked ? "Close" : "Cancel"}</Button>
      </div>
    </div>
  );
}
