"use client";
import { useEffect, useState } from "react";
import { del, get } from "@/lib/api";
import { resetMe, useMe } from "@/lib/auth";
import { ago } from "@/lib/ago";
import { addPasskey, passkeysSupported } from "@/lib/passkey";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

// Add and remove passkeys. Shared by Account and the setup wizard.
export function Passkeys() {
  const me = useMe();
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const load = () => get("/account/passkeys").then(setRows);
  useEffect(() => { load(); setOk(passkeysSupported()); }, []);
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim() || "Passkey";
    setErr("");
    try { await addPasskey(name); (e.target as HTMLFormElement).reset?.(); resetMe(); load(); } catch (x) { setErr((x as Error).name === "NotAllowedError" ? "No passkey was added" : (x as Error).message); }
  };
  if (!rows) return null;
  return (
    <div>
      <p className="max-w-lg text-sm text-muted">Sign in with your fingerprint, face or device PIN. Add one for each device you use, so losing one doesn't lock you out.</p>
      <ul className="mt-4 text-sm">{rows.map((k) => (
        <li key={k.id} className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
          <span><b className="font-medium">{k.name}</b><span className="block text-xs text-muted">added {ago(k.created_at)} · {k.last_used_at ? `used ${ago(k.last_used_at)}` : "not used yet"}</span></span>
          <button onClick={async () => { await del(`/account/passkeys/${k.id}`); resetMe(); load(); }} className="text-xs text-muted hover:text-ink">Remove</button>
        </li>))}</ul>
      {ok ? (
        <form onSubmit={add} noValidate className="mt-4 flex max-w-md items-start gap-3"><Field name="name" placeholder="Name, e.g. MacBook" /><Button>Add a passkey</Button></form>
      ) : <p className="mt-4 text-sm text-muted">This browser can't make passkeys. Use a recent Chrome, Safari or Firefox.</p>}
      {err && <p role="alert" className="mt-3 text-sm text-red-500">{err}</p>}
      {me?.must_setup_2fa && me.passwords !== false && <p className="mt-3 text-xs text-muted">A passkey is enough: you don't also need the authenticator app.</p>}
    </div>
  );
}
