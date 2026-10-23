"use client";
import { use, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { PlotForm } from "@/components/plot-form";

export default function EditPlot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plot, setPlot] = useState<any>(null);
  useEffect(() => { get(`/plots/${id}`).then((d) => setPlot(d.plot)); }, [id]);
  return plot ? <PlotForm plot={plot} /> : null;
}
