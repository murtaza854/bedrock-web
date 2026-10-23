"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "./icons";

const MODES = ["system", "light", "dark"] as const;
type Mode = (typeof MODES)[number];

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try { const m = localStorage.getItem("theme"); if (m === "light" || m === "dark") setMode(m); } catch {}
  }, []);
  useEffect(() => {
    apply(mode);
    try { localStorage.setItem("theme", mode); } catch {}
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const f = () => apply("system");
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [mode]);
  if (compact) {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    return (
      <button onClick={() => setMode(next)} title={`Theme: ${mode} (click for ${next})`} aria-label="Change theme"
        className="mx-auto rounded-md p-2 text-muted hover:bg-line/50 hover:text-ink">
        {mode === "light" ? <Sun /> : mode === "dark" ? <Moon /> : <Monitor />}
      </button>
    );
  }
  return (
    <div role="group" aria-label="Theme" className="flex rounded-md border border-line p-0.5 text-xs">
      {MODES.map((m) => (
        <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
          className={`flex-1 rounded px-2 py-1 capitalize ${mode === m ? "bg-line text-ink" : "text-muted hover:text-ink"}`}>{m}</button>
      ))}
    </div>
  );
}
