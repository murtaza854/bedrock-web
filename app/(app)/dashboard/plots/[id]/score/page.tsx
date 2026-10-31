"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get, post, put } from "@/lib/api";
import { DECISIONS, EVIDENCE_TONE, STATUS, num } from "@/lib/score";
import { cap, label } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Errors } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Can } from "@/components/can";
import { can, useMe } from "@/lib/auth";

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const Bar = ({ p }: { p: number }) => <div className="h-1 w-20 rounded-full bg-line"><div className="h-1 rounded-full bg-ink/70" style={{ width: `${Math.max(0, Math.min(100, p))}%` }} /></div>;
const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="border-t border-line pt-5">
    <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}{note && <span className="ml-3 normal-case tracking-normal">{note}</span>}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

export default function Scorecard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useMe();
  const [d, setD] = useState<any>(null);
  const [plot, setPlot] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [openSnap, setOpenSnap] = useState<number | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const load = () => get(`/plots/${id}/score`).then(setD);
  useEffect(() => { load(); get(`/plots/${id}`).then((x) => setPlot(x.plot)); get("/score/profiles").then(setProfiles); }, [id]);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!f.reasons.trim()) return setErrors({ reasons: "Write your reasons. They are saved with the score." });
    try { await post(`/plots/${id}/score/snapshots`, f); } catch { return setErrors({ form: "Could not save, try again" }); }
    setOpen(false); load();
  };
  if (!d) return null;
  const { profile: pr, sections, next_steps: steps, snapshots } = d;

  return (
    <div className="grid gap-10">
      <div>
        <Link href={`/dashboard/plots/${id}`} className="text-sm text-muted hover:text-ink">← {plot ? label(plot) : "Plot"}</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Scorecard</h1>
          <Select label="Profile" variant="ghost" disabled={!can(me, "scorecard", "u")} value={String(pr.id)} options={profiles.map((p) => ({ value: String(p.id), label: `${p.name} profile` }))}
            onChange={async (v) => { await put(`/plots/${id}/profile`, { profile_id: Number(v) }); load(); }} />
        </div>
        <div className="mt-6 flex flex-wrap items-end gap-x-12 gap-y-6">
          <div>
            <p className="text-7xl font-light tracking-tighter">{num(d.score)}<span className="ml-2 text-2xl text-muted">/ 100</span></p>
          </div>
          <div className="pb-2 text-sm">
            <p className="text-muted">{num(d.coverage)}% of the score is backed by verified information.</p>
            <div className="mt-1.5 h-1 w-56 rounded-full bg-line"><div className="h-1 rounded-full bg-accent" style={{ width: `${d.coverage}%` }} /></div>
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-xs text-muted">Unknown and unverified items score zero, so a low number can mean "not yet checked", not "bad". Weights and bands are your own rules, set in <Link href="/dashboard/scorecard/rules" className="underline hover:text-ink">Rules</Link>. This score supports your decision, it doesn't make it.</p>
      </div>

      {steps.length > 0 && (
        <Section title="What would raise it most" note="in score points">
          <ul className="text-sm">
            {steps.map((s: any) => (
              <li key={s.label} className="flex items-start justify-between gap-6 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <span><b className="font-medium">{s.label}</b><span className="mt-0.5 block text-xs text-muted">{s.hint}</span></span>
                <span className="flex shrink-0 items-center gap-4"><span className="text-muted">+{s.gain}</span>
                  <Link href={`/dashboard/plots/${id}`} className="text-xs text-muted hover:text-ink">Open →</Link></span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sections.map((s: any) => (
        <Section key={s.key} title={s.label} note={`${num(s.earned, 1)} of ${num(s.weight)} points`}>
          <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted"><th className="pb-2 text-left font-normal">Field</th><th className="pb-2 text-left font-normal">Value</th><th className="pb-2 text-left font-normal">Evidence</th><th className="pb-2 text-left font-normal">Fit</th><th className="pb-2 text-right font-normal">Points</th></tr></thead>
              <tbody>{s.fields.map((f: any) => (
                <tr key={f.key} className="border-t border-line align-top">
                  <td className="py-2.5 pr-4"><span className="font-medium">{f.label}</span></td>
                  <td className="pr-4">{f.display || <span className="text-muted">-</span>}{f.status !== "scored" && f.why && <p className="mt-0.5 max-w-xs text-xs text-muted">{f.why}</p>}</td>
                  <td className="pr-4"><span className="flex flex-wrap gap-1.5">{f.verification !== "none" && <Badge tone={EVIDENCE_TONE[f.verification]}>{cap(f.verification)}</Badge>}{f.status !== "scored" && <Badge tone={STATUS[f.status].tone}>{STATUS[f.status].label}</Badge>}</span></td>
                  <td className="pr-4 pt-3.5">{f.points != null && <Bar p={f.points * 100} />}</td>
                  <td className="text-right">{num(f.earned, 1)} <span className="text-muted">/ {num(f.weight)}</span></td>
                </tr>))}</tbody>
          </table>
        </Section>
      ))}

      <Section title="Decisions" note={`${snapshots.length} saved`}>
        <div className="mb-5 flex items-center justify-between">
          <p className="max-w-xl text-xs text-muted">Saving a decision freezes this score, its inputs and your reasons, so you can look back later and see whether your scoring held up.</p>
          <Can area="scorecard"><button onClick={() => { setErrors({}); setOpen(!open); }} className="shrink-0 text-sm text-muted hover:text-ink">{open ? "Cancel" : "+ Save a decision"}</button></Can>
        </div>
        {open && (
          <form onSubmit={save} noValidate className="mb-6 grid items-start gap-4 md:grid-cols-[12rem_1fr]">
            <Select name="decision" label="Decision" defaultValue="shortlist" options={DECISIONS.map((x) => ({ value: x.value, label: x.label }))} />
            <div><Textarea name="reasons" rows={2} placeholder="Why this decision?" aria-invalid={!!errors.reasons} autoFocus />{errors.reasons && <p role="alert" className="mt-1.5 text-xs text-red-500">{errors.reasons}</p>}</div>
            <div className="flex items-center gap-3 md:col-span-2"><Button>Freeze score and save</Button>{errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}</div>
          </form>
        )}
        {snapshots.length ? (
          <ul className="text-sm">
            {snapshots.map((s: any) => {
              const dec = DECISIONS.find((x) => x.value === s.decision)!;
              return (
                <li key={s.id} className="border-t border-line py-3.5 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-3"><Badge tone={dec.tone}>{dec.label}</Badge><span className="text-muted">{when(s.created_at)}</span></span>
                    <span className="text-muted">Score <b className="font-medium text-ink">{num(s.score)}</b>· {num(s.coverage)}% verified · {s.profile_name}</span>
                  </div>
                  <p className="mt-1.5">{s.reasons}</p>
                  <button onClick={() => setOpenSnap(openSnap === s.id ? null : s.id)} className="mt-1.5 text-xs text-muted hover:text-ink">{openSnap === s.id ? "Hide frozen inputs" : "Show frozen inputs"}</button>
                  {openSnap === s.id && (
                    <div className="mt-3 grid gap-x-8 gap-y-1 text-xs text-muted md:grid-cols-2">
                      {s.inputs.sections.flatMap((sec: any) =>
                        sec.fields.map((f: any) => <p key={f.key}>{f.label}: <span className="text-ink">{f.display || "unknown"}</span> ({f.status}, {num(f.earned, 1)}/{num(f.weight)})</p>))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-muted">No decisions saved yet.</p>}
      </Section>
    </div>
  );
}
