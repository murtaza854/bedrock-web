"use client";
import { use } from "react";
import { FeasibilityWizard } from "@/components/feasibility-wizard";

export default function Feasibility({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <FeasibilityWizard id={id} />;
}
