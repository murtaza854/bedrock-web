"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { patch, post } from "@/lib/api";
import { ROLES } from "@/lib/contacts";
import { cap } from "@/lib/plots";
import { Button } from "@/components/ui/button";
import { Errors, Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";

const Label = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 text-xs text-muted">{children}</p>;

// One form for adding and editing a contact. Pass `contact` to edit.
export function ContactForm({ contact }: { contact?: any }) {
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>(contact?.roles ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const back = contact ? `/dashboard/contacts/${contact.id}` : "/dashboard/contacts";
  const toggle = (r: string) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const err: Errors = {};
    if (!f.name.trim()) err.name = "Enter a name";
    if (f.phone.trim() && f.phone.replace(/\D/g, "").length < 7) err.phone = "Enter a valid phone number";
    if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email)) err.email = "Enter a valid email address";
    if (!roles.length) err.roles = "Pick at least one role";
    setErrors(err);
    if (Object.keys(err).length) return;
    const body = { name: f.name, phone: f.phone, email: f.email, company: f.company, notes: f.notes, roles };
    setBusy(true);
    try { await (contact ? patch(`/contacts/${contact.id}`, body) : post("/contacts", body)); }
    catch { setBusy(false); return setErrors({ form: "Could not save the contact" }); }
    router.push(contact ? back : "/dashboard/contacts");
  };

  return (
    <div className="max-w-xl">
      <Link href={back} className="text-sm text-muted hover:text-ink">← {contact ? "Back to contact" : "Contacts"}</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{contact ? "Edit contact" : "Add contact"}</h1>
      <form onSubmit={save} noValidate className="mt-8 grid gap-5">
        <div><Label>Name</Label><Field name="name" defaultValue={contact?.name} error={errors.name} autoFocus /></div>
        <div>
          <Label>Roles</Label>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button type="button" key={r} onClick={() => toggle(r)} aria-pressed={roles.includes(r)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition ${roles.includes(r) ? "bg-ink text-bg" : "bg-line/50 text-muted hover:bg-line"}`}>{cap(r)}</button>
            ))}
          </div>
          {errors.roles && <p role="alert" className="mt-1.5 text-xs text-red-500">{errors.roles}</p>}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><Label>Phone (optional)</Label><Field name="phone" type="tel" defaultValue={contact?.phone} error={errors.phone} /></div>
          <div><Label>Email (optional)</Label><Field name="email" type="email" defaultValue={contact?.email} error={errors.email} /></div>
        </div>
        <div><Label>Company (optional)</Label><Field name="company" defaultValue={contact?.company} /></div>
        <div><Label>Notes (optional)</Label><Textarea name="notes" rows={3} defaultValue={contact?.notes} /></div>
        <div className="flex items-center gap-2 pt-2">
          <Button disabled={busy}>{contact ? "Save changes" : "Add contact"}</Button>
          <Link href={back} className="rounded-lg bg-line/50 px-4 py-2.5 text-sm font-medium hover:bg-line">Cancel</Link>
        </div>
        {errors.form && <p role="alert" className="text-sm text-red-500">{errors.form}</p>}
      </form>
    </div>
  );
}
