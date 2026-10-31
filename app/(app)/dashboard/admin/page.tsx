"use client";
import { useEffect, useState } from "react";
import { del as remove, get, patch, post, put } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { download, toCsv } from "@/lib/csv";
import { cap } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const TABS = ["Users", "Roles", "Audit log", "Backups"] as const;
const AREAS: Record<string, string> = { plots: "Plots, quotes and facts", feasibility: "Feasibility", offers: "Offers and purchases", rates: "Tax and fee rates", contacts: "Contacts", tasks: "Tasks", map: "Map", bylaws: "Bylaws", scorecard: "Scorecard", settings: "Settings", admin: "Admin" };
const LETTERS: [string, string][] = [["c", "Create"], ["r", "Read"], ["u", "Update"], ["d", "Delete"]];
const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;
const Kpi = ({ k, v, sub, warn }: { k: string; v: React.ReactNode; sub?: string; warn?: boolean }) => (
  <div><p className="text-xs text-muted">{k}</p><p className={`mt-1.5 text-3xl font-light tracking-tight ${warn ? "text-red-500" : ""}`}>{v}</p><p className="mt-1 min-h-4 text-xs text-muted">{sub}</p></div>
);
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never");
const ago = (iso?: string | null) => { if (!iso) return "never"; const h = (Date.now() - new Date(iso).getTime()) / 3600000; return h < 1 ? "under an hour ago" : h < 48 ? `${Math.round(h)} hours ago` : `${Math.round(h / 24)} days ago`; };
const size = (n?: number | null) => (n == null ? "-" : n < 1 << 20 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1 << 20)).toFixed(1)} MB`);

function Users() {
  const me = useMe();
  const [rows, setRows] = useState<any[] | null>(null);
  const [add, setAdd] = useState(false);
  const [pw, setPw] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [role, setRole] = useState("editor");
  const [roles, setRoles] = useState<string[]>(["owner", "editor", "viewer"]);
  useEffect(() => { get("/admin/roles").then((d) => setRoles(d.roles.map((r: any) => r.name))).catch(() => {}); }, []);
  const [msg, setMsg] = useState("");
  const load = () => get("/admin/users").then(setRows);
  useEffect(() => { load(); }, []);
  const act = async (fn: () => Promise<unknown>, ok = "") => { setMsg(""); try { await fn(); setConfirm(null); setPw(null); setMsg(ok); load(); } catch (x) { setMsg((x as Error).message); } };

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const err: Errors = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email)) err.email = "Enter a valid email address";
    if (f.password.length < 10) err.password = "Use at least 10 characters";
    setErrors(err);
    if (Object.keys(err).length) return;
    try { await post("/admin/users", { ...f, role }); setAdd(false); setErrors({}); load(); } catch (x) { setErrors({ form: (x as Error).message }); }
  };
  const setPassword = async (e: React.FormEvent<HTMLFormElement>, id: number) => {
    e.preventDefault();
    const p = String(new FormData(e.currentTarget).get("password") ?? "");
    if (p.length < 10) return setErrors({ pw: "Use at least 10 characters" });
    setErrors({}); act(() => post(`/admin/users/${id}/password`, { password: p }), "Password set. They were signed out everywhere.");
  };
  if (!rows) return null;
  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between"><p className="text-sm text-muted">{rows.length} people</p><Button onClick={() => { setErrors({}); setAdd(!add); }}>{add ? "Cancel" : "Add a person"}</Button></div>
      {add && (
        <form onSubmit={create} noValidate className="grid items-start gap-4 md:grid-cols-4">
          <div><Lbl>Email</Lbl><Field name="email" type="email" error={errors.email} autoFocus /></div>
          <div><Lbl>Name (optional)</Lbl><Field name="name" /></div>
          <div><Lbl>Role</Lbl><Select label="Role" value={role} onChange={setRole} options={roles.map((r) => ({ value: r, label: cap(r) }))} /></div>
          <div><Lbl>Starting password</Lbl><Field name="password" type="password" autoComplete="new-password" error={errors.password} /></div>
          <div className="flex items-center gap-3 md:col-span-4"><Button>Add person</Button><p className="text-xs text-muted">Tell them the password in person, and ask them to change it and turn on two-factor.</p>{errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}</div>
        </form>
      )}
      {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Person</th><th className="pb-2 text-left font-normal">Role</th><th className="pb-2 text-left font-normal">Two-factor</th><th className="pb-2 text-right font-normal">Last sign-in</th><th /></tr></thead>
        <tbody>{rows.map((u) => {
          const self = u.email === me?.email, off = !!u.disabled_at;
          return (
            <tr key={u.id} className={`border-t border-line align-top ${off ? "opacity-50" : ""}`}>
              <td className="py-3"><span className="font-medium">{u.name || u.email}</span>{self && <span className="ml-2"><Badge>You</Badge></span>}{off && <span className="ml-2"><Badge tone="bad">Switched off</Badge></span>}
                {u.name && <p className="text-xs text-muted">{u.email}</p>}</td>
              <td><Select label={`Role of ${u.email}`} variant="ghost" className="-ml-2" value={u.role} disabled={self} onChange={(v) => act(() => patch(`/admin/users/${u.id}`, { role: v }), `${u.email} is now ${/^[aeiou]/i.test(v) ? "an" : "a"} ${v}. They were signed out.`)} options={roles.map((r) => ({ value: r, label: cap(r) }))} /></td>
              <td>{u.totp_enabled ? <Badge tone="good">On</Badge> : <Badge tone="warn">Off</Badge>}</td>
              <td className="text-right text-muted">{when(u.last_login_at)}</td>
              <td className="pl-4 text-right text-xs">
                {pw === u.id ? (
                  <form onSubmit={(e) => setPassword(e, u.id)} noValidate className="flex items-center justify-end gap-2"><div><Input name="password" type="password" placeholder="New password" aria-invalid={!!errors.pw} className="!py-1 text-xs" autoFocus />{errors.pw && <p role="alert" className="mt-1 text-red-500">{errors.pw}</p>}</div><button className="text-ink">Set</button><button type="button" onClick={() => setPw(null)} className="text-muted">Cancel</button></form>
                ) : confirm?.startsWith(`${u.id}:`) ? (
                  <span><button onClick={() => act(() => confirm.endsWith("2fa") ? post(`/admin/users/${u.id}/reset-2fa`, {}) : patch(`/admin/users/${u.id}`, { disabled: !off }), confirm.endsWith("2fa") ? "Two-factor reset. They can set it up again." : "")} className="text-red-500">Confirm</button><button onClick={() => setConfirm(null)} className="ml-3 text-muted">Cancel</button></span>
                ) : (
                  <span className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-muted">
                    <button onClick={() => { setErrors({}); setPw(u.id); }} className="hover:text-ink">Set password</button>
                    {u.totp_enabled && <button onClick={() => setConfirm(`${u.id}:2fa`)} className="hover:text-ink">Reset two-factor</button>}
                    {!self && <button onClick={() => setConfirm(`${u.id}:off`)} className="hover:text-ink">{off ? "Switch on" : "Switch off"}</button>}
                  </span>
                )}
              </td>
            </tr>);
        })}</tbody>
      </table>
    </div>
  );
}

function Audit() {
  const [users, setUsers] = useState<any[]>([]);
  const [rows, setRows] = useState<any[] | null>(null);
  const [more, setMore] = useState(false);
  const [user, setUser] = useState("");
  const [q, setQ] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => { get("/admin/users").then(setUsers); }, []);
  const qs = (before?: number) => `/admin/audit?limit=100${user ? `&user=${encodeURIComponent(user)}` : ""}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${failed ? "&failed=1" : ""}${before ? `&before=${before}` : ""}`;
  useEffect(() => { const t = setTimeout(() => get(qs()).then((r) => { setRows(r.rows); setMore(r.more); }), 250); return () => clearTimeout(t); }, [user, q, failed]);
  const loadMore = async () => { const r = await get(qs(rows![rows!.length - 1].id)); setRows([...rows!, ...r.rows]); setMore(r.more); };
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Select label="Person" variant="ghost" className="-ml-1" value={user} onChange={setUser} options={[{ value: "", label: "Everyone" }, ...users.map((u) => ({ value: u.email, label: u.email }))]} />
        <Input className="max-w-64" placeholder="Search what happened" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted"><input type="checkbox" checked={failed} onChange={(e) => setFailed(e.target.checked)} className="size-4 accent-[var(--ink)]" />Failures and refusals only</label>
        <button onClick={() => rows && download(`bedrock-audit-${new Date().toLocaleDateString("en-CA")}.csv`, toCsv(rows, [["at", "When"], ["user_email", "Who"], ["role", "Role"], ["action", "What"], ["path", "Path"], ["status", "Result"], ["entity_id", "Item"], ["ip", "Address"]]))} className="ml-auto text-sm text-muted hover:text-ink">Download these rows</button>
      </div>
      {rows && (rows.length ? (
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">When</th><th className="pb-2 text-left font-normal">Who</th><th className="pb-2 text-left font-normal">What</th><th className="pb-2 text-right font-normal">Result</th><th className="pb-2 pl-6 text-left font-normal">Address</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-t border-line align-top">
              <td className="whitespace-nowrap py-2.5 text-muted">{when(r.at)}</td>
              <td>{r.user_email || "-"}{r.role && <span className="ml-2 text-xs text-muted">{r.role}</span>}</td>
              <td className="font-mono text-xs">{r.action}{r.entity_id && <span className="text-muted"> #{r.entity_id}</span>}</td>
              <td className="text-right">{r.status ? <Badge tone={r.status >= 400 ? "bad" : "neutral"}>{r.status}</Badge> : ""}</td>
              <td className="pl-6 text-xs text-muted">{r.ip}</td>
            </tr>))}</tbody>
        </table>
      ) : <p className="py-6 text-sm text-muted">Nothing matches.</p>)}
      {more && <button onClick={loadMore} className="justify-self-start text-sm text-muted underline hover:text-ink">Show older</button>}
      <p className="max-w-2xl text-xs text-muted">Every change, every sign-in and failed attempt, every refused action, and every time a document, receipt or backup is opened. Rows can't be edited or deleted. Passwords and the contents of what you typed are never recorded.</p>
    </div>
  );
}

const DAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];

// When the automatic backup runs: on or off, which days, and what time. A backup missed because the server was off is made when it starts again.
function Schedule({ d, onSaved }: { d: any; onSaved: () => void }) {
  const [sch, setSch] = useState<{ enabled: boolean; days: number[]; time: string }>(d.schedule);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const toggleDay = (n: number) => setSch((x) => ({ ...x, days: x.days.includes(n) ? x.days.filter((k) => k !== n) : [...x.days, n] }));
  const save = async () => {
    setMsg(""); setErr("");
    try { await put("/admin/backup-schedule", sch); setMsg("Saved."); onSaved(); } catch (x) { setErr((x as Error).message); }
  };
  return (
    <section className="border-t border-line pt-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Automatic backups</h2>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={sch.enabled} onChange={(e) => setSch({ ...sch, enabled: e.target.checked })} />Make a backup automatically</label>
      <div className={`mt-4 grid gap-4 ${sch.enabled ? "" : "opacity-50"}`}>
        <div><Lbl>On these days</Lbl>
          <div className="flex flex-wrap gap-2">{DAYS.map(([n, t]) => (
            <button key={n} type="button" disabled={!sch.enabled} aria-pressed={sch.days.includes(n)} onClick={() => toggleDay(n)}
              className={`rounded-lg px-3.5 py-2 text-sm ${sch.days.includes(n) ? "bg-ink text-bg" : "bg-line/50 hover:bg-line"}`}>{t}</button>))}</div></div>
        <div className="max-w-40"><Lbl>At this time</Lbl><Input type="time" aria-label="Backup time" value={sch.time} disabled={!sch.enabled} onChange={(e) => setSch({ ...sch, time: e.target.value })} /></div>
      </div>
      <p className="mt-4 max-w-xl text-xs text-muted">Times are on this server's clock ({d.timezone}). If the server is off at that time, the backup is made when it starts again that day.</p>
      {d.forced_off && <p className="mt-3 max-w-xl text-xs text-red-500">Automatic backups are also switched off on the server itself (BACKUPS=0), so this schedule has no effect until that is removed.</p>}
      <div className="mt-4 flex items-center gap-3"><Button type="button" onClick={save}>Save schedule</Button>{msg && <p role="status" className="text-sm text-muted">{msg}</p>}{err && <p role="alert" className="text-sm text-red-500">{err}</p>}</div>
    </section>
  );
}

function Backups() {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () => get("/admin/backups").then(setD);
  useEffect(() => { load(); }, []);
  const run = async () => { setBusy(true); setErr(""); try { await post("/admin/backups", {}); } catch (x) { setErr((x as Error).message); } setBusy(false); load(); };
  const api = process.env.NEXT_PUBLIC_API;
  if (!d) return null;
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-muted">Each backup is the database (compressed and encrypted) plus the document files. The last {d.keep} are kept.</p>
        <Button onClick={run} disabled={busy}>{busy ? "Backing up..." : "Back up now"}</Button>
      </div>
      {err && <p role="alert" className="text-sm text-red-500">{err}</p>}
      <Schedule d={d} onSaved={load} />
      {d.backups.length ? (
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">When</th><th className="pb-2 text-left font-normal">How</th><th className="pb-2 text-left font-normal">Checked</th><th className="pb-2 text-right font-normal">Database</th><th className="pb-2 text-right font-normal">Documents</th><th /></tr></thead>
          <tbody>{d.backups.map((b: any) => (
            <tr key={b.id} className="border-t border-line align-top">
              <td className="py-3">{when(b.created_at)}</td><td className="text-muted">{b.kind === "auto" ? "Automatic" : "By hand"}</td>
              <td>{b.error ? <><Badge tone="bad">Failed</Badge><p className="mt-1 max-w-xs text-xs text-red-500">{b.error}</p></> : b.verified ? <Badge tone="good">Restores correctly</Badge> : <Badge tone="warn">Not verified</Badge>}</td>
              <td className="text-right text-muted">{size(b.db_size)}</td><td className="text-right text-muted">{size(b.docs_size)}</td>
              <td className="pl-4 text-right text-xs">{b.db_file && <span className="flex justify-end gap-3 text-muted"><a href={`${api}/admin/backups/${b.id}/download?which=db`} className="hover:text-ink">Database</a><a href={`${api}/admin/backups/${b.id}/download?which=docs`} className="hover:text-ink">Documents</a></span>}</td>
            </tr>))}</tbody>
        </table>
      ) : <p className="text-sm text-muted">No backups yet. Make the first one now.</p>}
      <section className="border-t border-line pt-5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">If you ever need to restore</h2>
        <div className="mt-4 grid max-w-2xl gap-3 text-sm text-muted">
          <p><b className="font-medium text-ink">Keep your encryption key (DOCS_KEY) somewhere separate from the backups.</b> Without it the database backup cannot be read, and neither can the stored documents. Losing the key means losing everything in them.</p>
          <p>"Restores correctly" means the backup was decrypted and read back in full right after it was made. To restore, run this in the API folder. It <b className="font-medium text-ink">overwrites the current database</b>:</p>
          <pre className="overflow-x-auto rounded-lg bg-line/50 p-3 text-xs text-ink">make restore FILE=data/backups/&lt;the database file&gt;</pre>
          <p>Copy the documents file's contents back into the documents folder. Download both files to a drive that isn't on this computer from time to time: a backup on the same disk doesn't protect you from losing the disk.</p>
        </div>
      </section>
    </div>
  );
}

// Roles: what each one may do in each tab. The three built-in ones are fixed; any others are yours to make.
type Draft = { id?: number; name: string; perms: Record<string, string>; builtin?: boolean };
function Roles() {
  const me = useMe();
  const owner = me?.role === "owner";
  const [d, setD] = useState<any>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [doomed, setDoomed] = useState<any>(null);
  const [err, setErr] = useState("");
  const load = () => get("/admin/roles").then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return null;
  const areas: string[] = d.areas;
  // Read comes with anything else, and taking Read away takes the rest with it
  const toggle = (a: string, l: string) => setEdit((e) => {
    if (!e || e.builtin) return e;
    const has = (e.perms[a] ?? "").includes(l);
    let next = LETTERS.map(([k]) => k).filter((k) => (k === l ? !has : (e.perms[a] ?? "").includes(k))).join("");
    if (l !== "r" && !has && !next.includes("r")) next = "r" + next;
    if (l === "r" && has) next = "";
    return { ...e, perms: { ...e.perms, [a]: next } };
  });
  const save = async () => {
    if (!edit) return;
    setErr("");
    try { await (edit.id ? put(`/admin/roles/${edit.id}`, { name: edit.name, perms: edit.perms }) : post("/admin/roles", { name: edit.name, perms: edit.perms })); setEdit(null); load(); }
    catch (x) { setErr((x as Error).message); }
  };
  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <p className="max-w-xl text-sm text-muted">A role says, for each tab, what a person may create, read, update and delete. The server enforces it, and a role change signs the person out so it applies straight away.</p>
        {owner && <Button onClick={() => { setErr(""); setEdit({ name: "", perms: Object.fromEntries(areas.map((a) => [a, ""])) }); }}>New role</Button>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Role</th><th className="pb-2 text-right font-normal">People</th><th /></tr></thead>
        <tbody>{d.roles.map((r: any) => (
          <tr key={r.id} className="border-t border-line">
            <td className="py-3 font-medium">{cap(r.name)}{r.builtin && <span className="ml-2"><Badge>Built in</Badge></span>}</td>
            <td className="text-right text-muted">{r.people}</td>
            <td className="pl-4 text-right text-xs"><span className="flex justify-end gap-2">
              <button onClick={() => { setErr(""); setEdit({ id: r.id, name: r.name, perms: { ...r.perms }, builtin: r.builtin }); }} className="rounded-lg bg-line/50 px-3 py-1.5 font-medium hover:bg-line">{r.builtin || !owner ? "View" : "Edit"}</button>
              {!r.builtin && owner && <button onClick={() => setDoomed(r)} className="rounded-lg bg-line/50 px-3 py-1.5 font-medium hover:bg-line">Delete</button>}
            </span></td>
          </tr>))}</tbody>
      </table>
      {edit && (
        <section className="border-t border-line pt-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{edit.id ? (edit.builtin ? `${cap(edit.name)}, built in` : `Edit ${edit.name}`) : "New role"}</h2>
          {!edit.builtin && <div className="mt-4 max-w-xs"><Lbl>Name</Lbl><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label="Role name" maxLength={40} placeholder="e.g. Analyst" /></div>}
          <table className="mt-5 w-full max-w-xl text-sm">
            <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Tab</th>{LETTERS.map(([k, n]) => <th key={k} className="pb-2 text-center font-normal">{n}</th>)}</tr></thead>
            <tbody>{areas.map((a) => (
              <tr key={a} className="border-t border-line"><td className="py-2.5">{AREAS[a] ?? a}</td>
                {LETTERS.map(([k, n]) => <td key={k} className="text-center"><input type="checkbox" className="size-4 accent-[var(--accent)]" aria-label={`${AREAS[a] ?? a} ${n}`} checked={(edit.perms[a] ?? "").includes(k)} disabled={edit.builtin || !owner} onChange={() => toggle(a, k)} /></td>)}</tr>))}</tbody>
          </table>
          {err && <p role="alert" className="mt-4 text-sm text-red-500">{err}</p>}
          <div className="mt-5 flex gap-2">
            {!edit.builtin && owner && <Button onClick={save}>{edit.id ? "Save role" : "Create role"}</Button>}
            <Button variant="ghost" onClick={() => setEdit(null)}>{edit.builtin || !owner ? "Close" : "Cancel"}</Button>
          </div>
        </section>)}
      <ConfirmDialog open={!!doomed} title={`Delete ${doomed?.name}?`} text="People with this role must be given another one first. This cannot be undone." confirm="Delete role"
        onClose={() => setDoomed(null)} onConfirm={() => remove(`/admin/roles/${doomed.id}`).then(load)} />
    </div>
  );
}

export default function Admin() {
  const me = useMe();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Users");
  const [s, setS] = useState<any>(null);
  useEffect(() => { get("/admin/summary").then(setS).catch(() => {}); }, [tab]);
  if (me && !can(me, "admin")) return <p className="text-sm text-muted">Your role cannot open this page.</p>;
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted">Who can get in, what they can do, what has happened, and whether your data is safe.</p>
      </div>
      {s && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
          <Kpi k="People" v={s.users} sub={`${s.owners} owner${s.owners === 1 ? "" : "s"}`} />
          <Kpi k="Without two-factor" v={s.without_2fa} sub={s.without_2fa ? "turn it on under Account" : "everyone is protected"} warn={s.without_2fa > 0 && s.users > 0} />
          <Kpi k="Failed sign-ins today" v={s.failed_logins} sub={`${s.denied} refused actions`} warn={s.failed_logins >= 5} />
          <Kpi k="Last good backup" v={<span className="text-2xl">{ago(s.last_backup)}</span>} sub={s.failed_backups ? `${s.failed_backups} failed this week` : ""} warn={!s.last_backup} />
        </div>
      )}
      <div className="flex gap-1 text-sm">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded-md px-3.5 py-1.5 ${tab === t ? "bg-line text-ink" : "text-muted hover:text-ink"}`}>{t}</button>)}</div>
      {tab === "Users" && <Users />}{tab === "Roles" && <Roles />}{tab === "Audit log" && <Audit />}{tab === "Backups" && <Backups />}
    </div>
  );
}
