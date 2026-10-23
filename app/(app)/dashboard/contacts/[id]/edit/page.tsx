"use client";
import { use, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { ContactForm } from "@/components/contact-form";

export default function EditContact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<any>(null);
  useEffect(() => { get(`/contacts/${id}`).then((d) => setC(d.contact)); }, [id]);
  return c ? <ContactForm contact={c} /> : null;
}
