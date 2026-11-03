"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { resetMe, useMe } from "@/lib/auth";
import { Contours } from "@/components/contours";
import { Passkeys } from "@/components/passkey-setup";
import { TwoFactor } from "@/components/two-factor-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// The setup wizard, after the password: secure the account with a passkey or the authenticator app (at least one, the other can be skipped).
// Nothing else in Bedrock opens until Finish. People who lost their only way in (an owner reset it) come back here too.
export default function Onboarding() {
  const me = useMe(), router = useRouter();
  const [err, setErr] = useState("");
  const [codesOpen, setCodesOpen] = useState(false); // the backup codes are on screen and not saved yet
  const [finished, setFinished] = useState(false);
  useEffect(() => { if (me && !me.must_setup_2fa && !finished) router.replace("/dashboard"); }, [me, router, finished]);
  if (finished) return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Contours />
      <div className="grid w-full max-w-sm gap-3 rounded-xl border border-line bg-surface/90 p-8 shadow-sm backdrop-blur">
        <p className="text-xs text-muted">Step 3 of 3</p>
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re all set</h1>
        <p className="mb-2 text-sm text-muted">Your account is secured. Next time, sign in the same way you just set up.</p>
        <Button onClick={() => router.replace("/dashboard")}>Open Bedrock</Button>
      </div>
    </main>
  );
  if (!me || !me.must_setup_2fa) return null;
  const done = me.totp_enabled || !!me.passkeys;
  const finish = async () => {
    setErr("");
    try { await post("/account/onboarding/finish", {}); setFinished(true); resetMe(); } catch (x) { setErr((x as Error).message); }
  };
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Contours />
      <div className="grid w-full max-w-2xl gap-6 rounded-xl border border-line bg-surface/90 p-6 shadow-sm backdrop-blur sm:p-8">
        <div>
          <p className="text-xs text-muted">Step 2 of 3</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Secure your account</h1>
          <p className="mt-2 text-sm text-muted">Choose at least one way to prove it&apos;s you when you sign in. You can set up both, or skip one. Bedrock opens when you finish.</p>
        </div>
        <section className="rounded-xl border border-line p-5">
          <h2 className="flex items-center gap-3 text-sm font-medium">Passkey <span className="text-xs font-normal text-muted">the easiest</span>{!!me.passkeys && <Badge tone="good">Done</Badge>}</h2>
          <div className="mt-4"><Passkeys /></div>
        </section>
        <section className="rounded-xl border border-line p-5">
          <h2 className="flex items-center gap-3 text-sm font-medium">Authenticator app{me.totp_enabled && <Badge tone="good">Done</Badge>}</h2>
          <div className="mt-4"><TwoFactor on={me.totp_enabled} reload={resetMe} onCodes={setCodesOpen} /></div>
        </section>
        <div className="flex flex-wrap items-center gap-4">
          <Button disabled={!done || codesOpen} onClick={finish}>Finish</Button>
          {!done && <p className="text-sm text-muted">Set up a passkey or the authenticator app to continue.</p>}
          {done && codesOpen && <p className="text-sm text-muted">Save your backup codes first.</p>}
          {err && <p role="alert" className="text-sm text-red-500">{err}</p>}
        </div>
      </div>
    </main>
  );
}
