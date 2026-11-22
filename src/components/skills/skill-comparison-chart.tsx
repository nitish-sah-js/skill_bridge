"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { name: string; current: number | null; required: number };

/** Grouped bars: measured proficiency vs the career target, per skill. */
export function SkillComparisonChart({ data }: { data: Row[] }) {
  const rows = data.map((d) => ({ ...d, current: d.current ?? 0, unassessed: d.current === null }));
  const height = Math.max(180, rows.length * 34 + 40);
  return (
    <figure>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }} barGap={2}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} stroke="var(--border)" />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
              stroke="var(--border)"
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
              formatter={(value, name, item) => {
                if (name === "Current" && (item.payload as { unassessed: boolean }).unassessed) return ["Not assessed", name];
                return [Math.round(Number(value)), name];
              }}
            />
            <Bar dataKey="current" name="Current" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={10} isAnimationActive={false} />
            <Bar dataKey="required" name="Target" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={10} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[var(--chart-1)]" aria-hidden /> Current proficiency
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[var(--chart-2)]" aria-hidden /> Career target
        </span>
        <span>Unassessed skills show no current bar.</span>
      </figcaption>
    </figure>
  );
}
