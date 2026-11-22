import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Clock, Code2, History, ListChecks, Target, type LucideIcon } from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { getProfile } from "@/features/profiles/service";
import { getCareer } from "@/features/careers/service";
import { listAttempts } from "@/features/assessments/service";
import { ASSESSMENT_CONFIG } from "@/config/engine";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { StartAssessmentButton } from "@/components/careers/career-actions";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatScore } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Assessment" };


export default async function AssessmentPage() {
  const { user, supabase } = await requireUser("/assessment");
  const [profile, attempts] = await Promise.all([getProfile(supabase, user.id), listAttempts(supabase, user.id)]);

  if (!profile.target_career_id) {
    return (
      <>
        <PageHeader title="Skill assessment" />
        <EmptyState
          icon={ClipboardCheck}
          title="Choose a target career first"
          action={
            <Link href="/careers" className={buttonVariants({ size: "lg" })}>
              Explore careers
            </Link>
          }
        >
          The assessment measures the skills your chosen career needs.
        </EmptyState>
      </>
    );
  }

  const career = await getCareer(supabase, profile.target_career_id);
  const forCareer = attempts.filter((a) => a.career_id === career.id);
  const open = forCareer.find((a) => a.status === "in_progress");
  const hasSubmitted = forCareer.some((a) => a.status === "submitted");
  const careerNames = new Map([[career.id, career.name]]);
  const { data: allCareers } = await supabase.from("careers").select("id, name");
  for (const c of allCareers ?? []) careerNames.set(c.id, c.name);

  const facts: { icon: LucideIcon; value: string; text: string }[] = [
    {
      icon: ListChecks,
      value: `${ASSESSMENT_CONFIG.questionCount} questions`,
      text: "Multiple choice across the career's skills, weighted toward core skills",
    },
    {
      icon: Code2,
      value: `${ASSESSMENT_CONFIG.practicalCount} practicals`,
      text: "Short practical challenges graded against a published rubric",
    },
    { icon: Clock, value: "About 30 minutes", text: "Runs fullscreen in its own window; answers save as you go" },
  ];

  return (
    <>
      <PageHeader
        title="Skill assessment"
        description={`Measures your current proficiency in the ${career.skills.length} skills a ${career.name} needs.`}
        actions={
          <Link
            href={`/careers/${career.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary transition-colors outline-none hover:bg-primary/25 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Target className="size-3.5" aria-hidden />
            {career.name}
          </Link>
        }
      />

      <section className={cn("surface", "p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
              <ClipboardCheck className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg leading-snug font-semibold">
                {open ? "You have an assessment in progress" : hasSubmitted ? "Take a follow-up assessment" : `${career.name} assessment`}
              </h2>
              {hasSubmitted && (
                <p className="text-sm leading-snug text-muted-foreground">
                  Follow-ups prefer questions you have not seen and add a new point to your skill history
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {open ? (
              <Link href={`/assessment/${open.id}`} className={buttonVariants({ size: "lg" })}>
                Resume assessment
              </Link>
            ) : (
              <StartAssessmentButton
                careerId={career.id}
                size="lg"
                label={hasSubmitted ? "Start follow-up assessment" : "Start assessment"}
              />
            )}
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {facts.map(({ icon: Icon, value, text }) => (
            <li key={value} className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{value}</p>
                <p className="text-xs leading-snug text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="history-title" className="mt-6">
        <div className="flex items-center gap-2">
          <History className="size-4 text-primary" aria-hidden />
          <h2 id="history-title" className="text-lg font-semibold">History</h2>
          {attempts.length > 0 && (
            <span className="rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
              {attempts.length}
            </span>
          )}
        </div>
        {attempts.length === 0 ? (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-snug text-foreground/80">No attempts yet. Your scores will appear here after you submit.</p>
            <Link href={`/careers/${career.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              See the skills it covers
            </Link>
          </div>
        ) : (
          <div className={cn("surface", "mt-3 overflow-x-auto")}>
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2 font-medium">Career</th>
                  <th scope="col" className="px-4 py-2 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Score</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className="border-t transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5">{formatDate(a.submitted_at ?? a.started_at)}</td>
                    <td className="px-4 py-2.5">{careerNames.get(a.career_id) ?? "Career"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {a.kind === "follow_up" ? "Follow-up" : "Initial"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {a.status === "submitted" ? (
                        <span className="inline-flex items-center gap-2">
                          {typeof a.total_score === "number" && (
                            <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                              <span
                                className="block h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(0, Math.min(100, a.total_score))}%` }}
                              />
                            </span>
                          )}
                          <span className="font-semibold">{`${formatScore(a.total_score)}/100`}</span>
                          {a.auto_submitted && (
                            <span className="rounded-full bg-developing/15 px-2 py-0.5 text-[11px] font-medium text-developing">
                              Auto-submitted
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="rounded-full bg-developing/15 px-2 py-0.5 text-[11px] font-medium text-developing">In progress</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/assessment/${a.id}`}
                        className={buttonVariants({ variant: a.status === "submitted" ? "ghost" : "outline", size: "sm" })}
                      >
                        {a.status === "submitted" ? "Results" : "Resume"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
