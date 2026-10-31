"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get, patch, post, put } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { reloadSettings } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="border-t border-line pt-5">
    <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}{note && <span className="ml-3 normal-case tracking-normal">{note}</span>}</h2>
    <div className="mt-4">{children}</div>
  </section>
);
const Lbl = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;

function Preferences({ owner }: { owner: boolean }) {
  const [d, setD] = useState<any>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<any[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState("");
  const load = () => get("/settings").then((r) => { setD(r); setVals(Object.fromEntries(r.defs.map((x: any) => [x.key, r.values[x.key] == null ? "" : String(r.values[x.key])]))); });
  useEffect(() => { load(); get("/score/profiles").then(setProfiles); }, []);
  if (!d) return null;

  const defs: any[] = d.defs, base = (k: string) => (d.values[k] == null ? "" : String(d.values[k]));
  const dirty = defs.filter((x) => vals[x.key] !== base(x.key));
  const set = (k: string, v: string) => { setMsg(""); setErrors((e) => ({ ...e, [k]: "" })); setVals((o) => ({ ...o, [k]: v })); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Errors = {};
    for (const x of dirty.filter((x) => x.kind === "number")) {
      const n = Number(vals[x.key]);
      if (vals[x.key].trim() === "" || !Number.isInteger(n) || n < x.min || n > x.max) err[x.key] = `A whole number from ${x.min} to ${x.max}`;
    }
    setErrors(err);
    if (Object.keys(err).length) return;
    // a value equal to the default is stored as "no override", so the default can change later
    const body = Object.fromEntries(dirty.map((x) => [x.key, x.kind === "number" && vals[x.key] === x.default ? "" : vals[x.key]]));
    try { await put("/admin/settings", body); } catch (x) { return setErrors({ form: (x as Error).message }); }
    await reloadSettings(); await load(); setMsg("Saved. The whole app uses these now.");
  };
  const reset = (x: any) => set(x.key, x.default);
  const profileOpts = [{ value: "", label: profiles[0] ? `First profile (${profiles[0].name})` : "First profile" }, ...profiles.map((p) => ({ value: String(p.id), label: p.name }))];

  return (
    <form onSubmit={save} noValidate className="grid gap-10">
      <Section title="Project">
        <div className="grid max-w-xl gap-5 sm:grid-cols-2">
          <div><Lbl>Project name</Lbl><Field value={vals.project_name ?? ""} onChange={(e) => set("project_name", e.target.value)} placeholder="Shown under Bedrock" disabled={!owner} error={errors.project_name} /></div>
          <div><Lbl>Default scoring profile</Lbl><Select label="Default scoring profile" value={vals.default_profile ?? ""} onChange={(v) => set("default_profile", v)} options={profileOpts} disabled={!owner} /></div>
        </div>
        <p className="mt-3 max-w-xl text-xs text-muted">{defs.find((x) => x.key === "default_profile")?.hint} This is where you say whether the project is mostly residential or commercial.</p>
      </Section>

      <Section title="Your rules" note="the numbers behind the alerts and the warnings">
        <ul className="text-sm">
          {defs.filter((x) => x.kind === "number").map((x) => (
            <li key={x.key} className="grid gap-x-8 gap-y-2 border-t border-line py-4 first:border-t-0 first:pt-0 sm:grid-cols-[1fr_15rem]">
              <div><p className="font-medium">{x.label}{x.changed && <span className="ml-2"><Badge tone="info">Changed</Badge></span>}</p><p className="mt-0.5 max-w-lg text-xs text-muted">{x.hint}</p></div>
              <div>
                <div className="flex items-center gap-2"><div className="w-24"><Field type="number" min={x.min} max={x.max} value={vals[x.key] ?? ""} onChange={(e) => set(x.key, e.target.value)} disabled={!owner} error={errors[x.key]} /></div><span className="text-xs text-muted">{x.unit}</span></div>
                <p className="mt-1.5 text-xs text-muted">Default {x.default}{vals[x.key] !== x.default && owner && <> · <button type="button" onClick={() => reset(x)} className="underline hover:text-ink">Use the default</button></>}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {owner ? (
        <div className="flex items-center gap-3">
          <Button disabled={!dirty.length}>Save changes</Button>
          {dirty.length > 0 && <span className="text-xs text-muted">{dirty.length} unsaved</span>}
          {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
          {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}
        </div>
      ) : <p className="text-sm text-muted">Only an owner can change these. You can see what they are set to.</p>}
    </form>
  );
}

export default function Settings() {
  const me = useMe();
  const [server, setServer] = useState<any>(null);
  useEffect(() => { get("/settings").then((r) => setServer(r.server)); }, []);
  const owner = can(me, "settings", "u"); // may change the settings
  return (
    <div className="grid max-w-3xl gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Your own rules for what counts as a problem, and what a plot needs. Treat them as starting guesses and adjust them as you learn.</p>
      </div>
      <Preferences owner={owner} />
      <Section title="Rules you set elsewhere">
        <ul className="text-sm">
          {[
            ["/dashboard/scorecard/rules", "Scoring rules", "The weights and ideal ranges behind every score, per profile."],
            ["/dashboard/settings/rates", "Tax and fee rates", "Each with the date it took effect."],
            ["/dashboard/bylaws", "Bylaws", "Floor area ratio, coverage, floors, height and setbacks."],
          ].map(([href, t, n]) => (
            <li key={href} className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0"><span><Link href={href} className="font-medium">{t}</Link><span className="block text-xs text-muted">{n}</span></span><Link href={href} className="text-xs text-muted hover:text-ink">Open →</Link></li>
          ))}
        </ul>
      </Section>

      {server && (
        <Section title="This server" note="set where the app runs, not here">
          <dl className="grid max-w-md gap-2 text-sm">
            {[["Time zone", server.timezone], ["Sign-in", server.login_off ? "Switched off (development)" : "On"], ["Automatic backups", server.backups ? `Daily at about ${String(server.backup_hour).padStart(2, "0")}:00, the last ${server.backup_keep} kept` : "Off"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line/60 pb-2"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          {owner && <p className="mt-3 text-xs"><Link href="/dashboard/admin" className="text-muted underline hover:text-ink">People, audit log and backups →</Link></p>}
        </Section>
      )}
    </div>
  );
}
