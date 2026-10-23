"use client";
import { useEffect, useState } from "react";
import { get, patch, post } from "@/lib/api";
import { ROLES, useMe } from "@/lib/auth";
import { download, toCsv } from "@/lib/csv";
import { cap } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const TABS = ["Users", "Audit log", "Backups"] as const;
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
          <div><Lbl>Role</Lbl><Select label="Role" value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r.value, label: r.label }))} /></div>
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
              <td><Select label={`Role of ${u.email}`} variant="ghost" className="-ml-2" value={u.role} disabled={self} onChange={(v) => act(() => patch(`/admin/users/${u.id}`, { role: v }), `${u.email} is now ${v === "editor" ? "an" : "a"} ${v}. They were signed out.`)} options={ROLES.map((r) => ({ value: r.value, label: r.label }))} /></td>
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
      <section className="border-t border-line pt-5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">What each role can do</h2>
        <ul className="mt-4 grid gap-2 text-sm">{ROLES.map((r) => <li key={r.value} className="flex gap-4"><b className="w-16 shrink-0 font-medium">{r.label}</b><span className="text-muted">{r.note}</span></li>)}</ul>
        <p className="mt-4 max-w-2xl text-xs text-muted">These limits are enforced by the server, not just hidden on screen. A role change signs the person out so it takes effect straight away. There must always be one active owner.</p>
      </section>
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
        <p className="max-w-xl text-sm text-muted">{d.auto ? `A backup is made automatically every day at about ${String(d.hour).padStart(2, "0")}:00, and the last ${d.keep} are kept.` : "Automatic backups are switched off on this server."} Each one is the database (compressed and encrypted) plus the document files.</p>
        <Button onClick={run} disabled={busy}>{busy ? "Backing up..." : "Back up now"}</Button>
      </div>
      {err && <p role="alert" className="text-sm text-red-500">{err}</p>}
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

export default function Admin() {
  const me = useMe();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Users");
  const [s, setS] = useState<any>(null);
  useEffect(() => { get("/admin/summary").then(setS).catch(() => {}); }, [tab]);
  if (me && me.role !== "owner") return <p className="text-sm text-muted">Only an owner can open this page.</p>;
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
      {tab === "Users" && <Users />}{tab === "Audit log" && <Audit />}{tab === "Backups" && <Backups />}
    </div>
  );
}
