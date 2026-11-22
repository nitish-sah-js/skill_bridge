"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyActivity } from "@/features/progress/calculations";
import type { SkillHistorySeries } from "@/features/progress/service";
import { nativeSelectClass } from "@/components/forms/field";
import { buttonVariants } from "@/components/ui/button";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};
const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };

function weekLabel(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

export function ActivityChart({ data }: { data: WeeklyActivity[] }) {
  const rows = data.map((d) => ({ ...d, label: weekLabel(d.weekStart), hours: Math.round((d.minutes / 60) * 10) / 10 }));
  const empty = data.every((d) => d.tasksCompleted === 0 && d.assessments === 0);
  return (
    <figure>
      <div className="relative h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: -16, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={axisTick} stroke="var(--border)" />
            <YAxis allowDecimals={false} tick={axisTick} stroke="var(--border)" />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
            <Bar dataKey="tasksCompleted" name="Tasks completed" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="assessments" name="Assessments" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        {empty && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-primary/25 bg-card/90 px-4 py-3 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              <Link href="/roadmap" className={buttonVariants({ size: "sm" })}>
                Start a roadmap task
              </Link>
            </div>
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[var(--chart-1)]" aria-hidden /> Tasks completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[var(--chart-2)]" aria-hidden /> Assessments submitted
        </span>
        <span>Last 8 weeks (UTC)</span>
      </figcaption>
    </figure>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  initial_assessment: "Initial assessment",
  follow_up_assessment: "Follow-up assessment",
};

export function SkillHistoryChart({ series, targets }: { series: SkillHistorySeries[]; targets: Record<string, number> }) {
  const [skillId, setSkillId] = useState(series[0]?.skillId ?? "");
  const selected = series.find((s) => s.skillId === skillId) ?? series[0];
  if (!selected) return null;
  const rows = selected.points.map((p) => ({
    date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(p.recordedAt)),
    proficiency: p.proficiency,
    source: SOURCE_LABEL[p.sourceType] ?? p.sourceType,
  }));
  const target = targets[selected.skillId];

  return (
    <figure>
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor="history-skill" className="text-sm text-muted-foreground">
          Skill
        </label>
        <select id="history-skill" value={selected.skillId} onChange={(e) => setSkillId(e.target.value)} className={`${nativeSelectClass} w-auto`}>
          {series.map((s) => (
            <option key={s.skillId} value={s.skillId}>
              {s.skillName}
            </option>
          ))}
        </select>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: -16, right: 16, top: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tick={axisTick} stroke="var(--border)" />
            <YAxis domain={[0, 100]} tick={axisTick} stroke="var(--border)" />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, _n, item) => [`${Math.round(Number(v))} (${(item.payload as { source: string }).source})`, "Proficiency"]}
            />
            {target !== undefined && (
              <ReferenceLine y={target} stroke="var(--target)" strokeDasharray="4 4" label={{ value: `Target ${target}`, fill: "var(--muted-foreground)", fontSize: 11, position: "insideTopRight" }} />
            )}
            <Line type="monotone" dataKey="proficiency" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Each point is a recorded assessment result. Task completion does not change these values.
      </figcaption>
    </figure>
  );
}
