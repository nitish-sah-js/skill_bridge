import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleSlash, Code2, ListChecks, Map as MapIcon, Target, XCircle, type LucideIcon } from "lucide-react";
import type { SubmittedAttempt } from "@/features/assessments/service";
import { classifySkill } from "@/features/skill-gap/engine";
import { ASSESSMENT_CONFIG, PROCTORING_CONFIG } from "@/config/engine";
import { GapGauge } from "@/components/skills/gap-gauge";
import { SkillStatusBadge } from "@/components/skills/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatScore } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
      <Icon className="size-4.5" aria-hidden />
    </span>
  );
}

export function AssessmentResults({
  attempt,
  requiredBySkill,
}: {
  attempt: SubmittedAttempt;
  requiredBySkill: Map<string, number>;
}) {
  const { totals } = attempt;
  const assessed = attempt.skills.filter((s) => s.status === "assessed");
  const insufficient = attempt.skills.filter((s) => s.status !== "assessed");
  const overall = Math.round(totals.totalScore);
  const correct = attempt.questions.filter((q) => q.selectedIndex !== null && q.isCorrect).length;
  const unanswered = attempt.questions.filter((q) => q.selectedIndex === null).length;
  const incorrect = attempt.questions.length - correct - unanswered;

  const breakdown: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: ListChecks, label: "Multiple choice", value: `${totals.mcqEarned} / ${totals.mcqAvailable} points` },
    { icon: Code2, label: "Practical", value: `${totals.practicalEarned} / ${totals.practicalAvailable} points` },
    { icon: CalendarDays, label: "Submitted", value: formatDate(attempt.submittedAt) },
  ];

  return (
    <div className="grid gap-6">
      {attempt.autoSubmitted && (
        <p role="status" className="rounded-lg border border-l-4 border-developing/50 border-l-developing bg-developing/10 px-4 py-3 text-sm leading-relaxed">
          <strong>Auto-submitted after {PROCTORING_CONFIG.maxWarnings + 1} rule breaks.</strong> The test window was left,
          reloaded or taken out of fullscreen too many times, so the answers saved at that point were scored.
        </p>
      )}
      <section className={cn("surface", "grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(220px,auto)_1fr_auto] lg:items-center lg:gap-6")}>
        <div>
          <p className="text-sm text-muted-foreground">Overall score</p>
          <p className="font-heading text-5xl leading-none font-semibold text-primary tabular-nums">
            {overall}
            <span className="text-2xl text-muted-foreground">/100</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, overall))}%` }} />
          </div>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {breakdown.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3">
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2 lg:flex-col">
          <Link href="/roadmap" className={buttonVariants({ size: "lg" })}>
            <MapIcon aria-hidden /> Go to roadmap
          </Link>
          <Link href="/skill-gap" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <Target aria-hidden /> View skill gaps
          </Link>
        </div>
      </section>

      <section aria-labelledby="skills-title" className={cn("surface", "p-4 sm:p-5")}>
        <div className="flex items-start gap-3">
          <IconBadge icon={Target} />
          <div>
            <h2 id="skills-title" className="text-lg leading-snug font-semibold">Skill proficiency</h2>
            <p className="text-sm leading-snug text-muted-foreground">
              Skill score = {Math.round(ASSESSMENT_CONFIG.mcqWeight * 100)}% multiple choice +{" "}
              {Math.round(ASSESSMENT_CONFIG.practicalWeight * 100)}% practical when a practical was attempted. The amber
              tick marks your career target.
            </p>
          </div>
        </div>
        <ul className="mt-4 grid gap-1">
          {assessed.map((s) => {
            const required = requiredBySkill.get(s.skillId) ?? 0;
            const status = classifySkill(required, s.proficiency);
            return (
              <li
                key={s.skillId}
                className="grid gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40 sm:grid-cols-[200px_1fr_auto] sm:items-center sm:gap-5"
              >
                <span className="font-medium leading-snug">{s.skillName}</span>
                <GapGauge current={s.proficiency} required={required} status={status} label={s.skillName} />
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-right text-base font-semibold tabular-nums">{formatScore(s.proficiency)}/100</span>
                  <SkillStatusBadge status={status} />
                </div>
              </li>
            );
          })}
        </ul>
        {insufficient.length > 0 && (
          <div className="mt-3 flex gap-2.5 rounded-lg border border-dashed bg-muted/30 p-3 text-sm leading-snug text-muted-foreground">
            <CircleSlash className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Not enough evidence to score: {insufficient.map((s) => s.skillName).join(", ")}. These skills had fewer than{" "}
              {ASSESSMENT_CONFIG.minQuestionsPerSkill} questions and no practical, so they remain unassessed rather than zero.
            </p>
          </div>
        )}
      </section>

      {attempt.challenges.length > 0 && (
        <section aria-labelledby="practical-title">
          <div className="flex items-center gap-2">
            <Code2 className="size-4 text-primary" aria-hidden />
            <h2 id="practical-title" className="text-lg font-semibold">Practical challenges</h2>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {attempt.challenges.map((c) => (
              <article key={c.id} className={cn("surface", "p-4")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug">{c.title}</h3>
                    <span className="mt-1 inline-block rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {c.skillName}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums",
                      c.attempted ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {c.attempted ? `${c.awardedPoints}/${c.maxPoints}` : "Skipped"}
                  </span>
                </div>
                {c.attempted ? (
                  <ul className="mt-3 grid gap-1.5 text-sm">
                    {c.feedback.map((f) => (
                      <li key={f.key} className="flex gap-2">
                        {f.met ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-strong" aria-label="Met" />
                        ) : (
                          <XCircle className="mt-0.5 size-4 shrink-0 text-beginner" aria-label="Missed" />
                        )}
                        <span className="leading-snug">
                          {f.description}
                          {!f.met && f.hint && <span className="block text-muted-foreground">{f.hint}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-snug text-muted-foreground">Not attempted, so this skill was scored from multiple choice only.</p>
                )}
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium text-primary">Your answer and a reference answer</summary>
                  <p className="mt-2 font-medium">Your answer</p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{c.submission || "(blank)"}</pre>
                  <p className="mt-2 font-medium">What a strong answer contains</p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{c.expectedOutput}</pre>
                </details>
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="answers-title">
        <div className="flex flex-wrap items-center gap-2">
          <ListChecks className="size-4 text-primary" aria-hidden />
          <h2 id="answers-title" className="text-lg font-semibold">Answer review</h2>
          <ul className="flex flex-wrap gap-1.5 text-[11px] font-medium tabular-nums">
            <li className="rounded-full bg-strong/15 px-2 py-0.5 text-strong">{correct} correct</li>
            <li className="rounded-full bg-beginner/15 px-2 py-0.5 text-beginner">{incorrect} incorrect</li>
            {unanswered > 0 && <li className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{unanswered} unanswered</li>}
          </ul>
        </div>
        <ol className="mt-3 grid gap-2">
          {attempt.questions.map((q, i) => (
            <li key={q.id}>
              <details className="group rounded-lg border bg-card transition-colors open:border-primary/40 hover:border-primary/30">
                <summary className="flex cursor-pointer list-none items-start gap-3 px-3.5 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  {q.selectedIndex === null ? (
                    <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Unanswered" />
                  ) : q.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-strong" aria-label="Correct" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-beginner" aria-label="Incorrect" />
                  )}
                  <span className="flex-1 leading-snug">
                    <span className="text-muted-foreground tabular-nums">{i + 1}. </span>
                    {q.text}
                  </span>
                  <span className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">{q.skillName}</span>
                </summary>
                <div className="border-t px-3.5 py-3 text-sm">
                  <ul className="grid gap-1">
                    {q.options.map((o, oi) => (
                      <li
                        key={oi}
                        className={cn(
                          "rounded-md px-2 py-1 leading-snug",
                          oi === q.correctIndex && "bg-strong/10 font-medium",
                          oi === q.selectedIndex && !q.isCorrect && "bg-beginner/10 line-through decoration-beginner/60",
                        )}
                      >
                        {o}
                        {oi === q.correctIndex && <span className="sr-only"> (correct answer)</span>}
                        {oi === q.selectedIndex && <span className="text-muted-foreground"> (your answer)</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2.5 leading-snug text-muted-foreground">{q.explanation}</p>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
