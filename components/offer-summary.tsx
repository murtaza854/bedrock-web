"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { STATUS_TONE, TURN, money, position } from "@/lib/offers";
import { cap } from "@/lib/plots";
import { Badge } from "@/components/ui/badge";

export function OfferSummary({ plotId }: { plotId: string }) {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => { get(`/plots/${plotId}/negotiations`).then(setList); }, [plotId]);
  if (!list) return null;
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Offers<span className="ml-3 normal-case tracking-normal">{list.filter((n) => n.status === "open").length} open</span></h2>
        <Link href={`/dashboard/offers/new?plot=${plotId}`} className="text-sm text-muted hover:text-ink">+ New negotiation</Link>
      </div>
      {list.length ? (
        <ul className="mt-4 text-sm">
          {list.map((n) => { const p = position(n); return (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2.5 first:border-t-0 first:pt-0">
              <Link href={`/dashboard/offers/${n.id}`} className="font-medium">{n.counterparty}</Link>
              <span className="flex items-center gap-4 text-muted">
                {p.ours && <span>We offered {money(p.ours.amount_pkr)}</span>}{p.theirs && <span>They asked {money(p.theirs.amount_pkr)}</span>}
                {n.status === "open" ? (p.turn && <Badge tone={TURN[p.turn].tone}>{TURN[p.turn].label}</Badge>) : <Badge tone={STATUS_TONE[n.status]}>{cap(n.status)}{n.status === "accepted" && ` ${money(n.agreed_pkr)}`}</Badge>}
              </span>
            </li>); })}
        </ul>
      ) : <p className="mt-4 text-sm text-muted">No negotiations on this plot yet.</p>}
    </section>
  );
}
