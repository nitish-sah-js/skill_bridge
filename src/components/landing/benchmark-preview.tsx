"use client";

import { useState } from "react";
import { GapGauge } from "@/components/skills/gap-gauge";
import { GAP_CONFIG } from "@/config/engine";
import { cn } from "@/lib/utils";

type ExampleSkill = { label: string; current: number | null; required: number };
type ExampleRole = { key: string; tab: string; title: string; note: string; skills: ExampleSkill[] };

const ROLES: ExampleRole[] = [
  {
    key: "cyber",
    tab: "Cybersecurity",
    title: "Cybersecurity Engineer",
    note: "Next up for this student: Linux, then cryptography.",
    skills: [
      { label: "Computer Networking", current: 78, required: 75 },
      { label: "Python Programming", current: 54, required: 65 },
      { label: "Linux Fundamentals", current: 32, required: 70 },
      { label: "Cryptography", current: null, required: 60 },
    ],
  },
  {
    key: "aiml",
    tab: "AI / ML",
    title: "AI/ML Engineer",
    note: "Next up for this student: linear algebra, then model deployment.",
    skills: [
      { label: "Python for Data Science", current: 72, required: 80 },
      { label: "Machine Learning Concepts", current: 80, required: 70 },
      { label: "Linear Algebra & Calculus", current: 40, required: 75 },
      { label: "Model Deployment", current: null, required: 65 },
    ],
  },
  {
    key: "web",
    tab: "Web Dev",
    title: "Web Developer",
    note: "Next up for this student: backend APIs, then JavaScript fundamentals.",
    skills: [
      { label: "HTML & CSS", current: 85, required: 80 },
      { label: "JavaScript", current: 60, required: 75 },
      { label: "Backend APIs & Databases", current: 28, required: 65 },
      { label: "Web Security", current: null, required: 70 },
    ],
  },
  {
    key: "cloud",
    tab: "Cloud DevOps",
    title: "Cloud DevOps Engineer",
    note: "Next up for this student: infrastructure as code, then Kubernetes.",
    skills: [
      { label: "Docker & Containers", current: 78, required: 70 },
      { label: "Kubernetes", current: 45, required: 75 },
      { label: "Infrastructure as Code", current: 25, required: 65 },
      { label: "Cloud Security", current: null, required: 60 },
    ],
  },
];

function statusOf(current: number | null, required: number) {
  if (current === null) return "not_assessed" as const;
  const ratio = current / required;
  if (ratio >= GAP_CONFIG.strongRatio) return "strong" as const;
  if (ratio >= GAP_CONFIG.developingRatio) return "developing" as const;
  return "beginner" as const;
}

/** Interactive example of the gap gauge for a few careers. Static sample data, not a real student. */
export function BenchmarkPreview() {
  const [activeKey, setActiveKey] = useState(ROLES[0].key);
  const role = ROLES.find((r) => r.key === activeKey) ?? ROLES[0];

  return (
    <figure className="relative w-full max-w-xl overflow-hidden rounded-xl border border-white/12 border-t-emerald-400/40 bg-[#0c1611]/90 p-5 shadow-[0_24px_64px_-16px_rgb(0_0_0/0.9),0_0_48px_rgb(52_211_153/0.1)] backdrop-blur-md sm:p-6">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-400/50 to-transparent" />

      <figcaption className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-4">
        <span className="font-heading text-lg font-semibold text-white sm:text-xl">{role.title}</span>
        <span className="shrink-0 rounded-md border border-emerald-400/30 bg-emerald-950/40 px-2.5 py-1 font-mono text-[11px] text-emerald-200">
          Example student
        </span>
      </figcaption>

      <div role="group" aria-label="Example career" className="my-4 flex flex-wrap gap-1.5 rounded-xl border border-white/6 bg-black/40 p-1">
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={r.key === role.key}
            onClick={() => setActiveKey(r.key)}
            className={cn(
              "rounded-lg border px-3.5 py-1.5 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
              r.key === role.key
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                : "border-transparent text-zinc-400 hover:bg-white/4 hover:text-zinc-200",
            )}
          >
            {r.tab}
          </button>
        ))}
      </div>

      <ul className="grid gap-4">
        {role.skills.map((s) => (
          <li key={s.label}>
            <div className="mb-2 flex justify-between gap-4 text-sm">
              <span className="font-medium text-zinc-200">{s.label}</span>
              <span className="font-mono text-xs tabular-nums text-zinc-400">
                {s.current === null ? "not assessed" : s.current} / {s.required}
              </span>
            </div>
            <GapGauge current={s.current} required={s.required} status={statusOf(s.current, s.required)} label={s.label} />
          </li>
        ))}
      </ul>

      <p className="mt-5 border-t border-white/10 pt-3 text-sm leading-snug text-zinc-300">
        The amber tick is the career target. Hatching is the gap still to close. {role.note}
      </p>
    </figure>
  );
}
