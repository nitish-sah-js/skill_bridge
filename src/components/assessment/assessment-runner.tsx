"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CloudOff, Code2, ListChecks, Loader2, Scale, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { InProgressAttempt } from "@/features/assessments/service";

type SaveState = "idle" | "saving" | "saved" | "error";

const DIFFICULTY_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;

/**
 * One item per screen: MCQs first, then practical challenges, then a review screen.
 * Answers autosave to the server so the attempt can be resumed on any device.
 */
export function AssessmentRunner({
  attempt,
  onDraftChange,
  onSubmitted,
}: {
  attempt: InProgressAttempt;
  /** Receives every answer change, e.g. so a rule-break report can carry the latest draft. */
  onDraftChange?: (draft: { answers: Record<string, number | null>; practicals: Record<string, string> }) => void;
  /** Replaces the default refresh after a successful submit. */
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const total = attempt.questions.length + attempt.challenges.length;
  const [answers, setAnswers] = useState<Record<string, number | null>>(attempt.draftAnswers);
  const [practicals, setPracticals] = useState<Record<string, string>>(attempt.draftPracticals);
  const firstUnanswered = attempt.questions.findIndex((q) => answers[q.id] === undefined || answers[q.id] === null);
  const [index, setIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ answers, practicals });
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    latest.current = { answers, practicals };
    onDraftChange?.({ answers, practicals });
  }, [answers, practicals, onDraftChange]);

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      await apiFetch(`/api/assessments/${attempt.id}`, { method: "PATCH", json: latest.current });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [attempt.id]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), 800);
  }, [save]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  const answeredCount = attempt.questions.filter((q) => typeof answers[q.id] === "number").length;
  const practicalCount = attempt.challenges.filter((c) => (practicals[c.id] ?? "").trim().length > 0).length;
  const isReview = index === total;
  const question = index < attempt.questions.length ? attempt.questions[index] : null;
  const challenge = !question && !isReview ? attempt.challenges[index - attempt.questions.length] : null;

  const unansweredNumbers = useMemo(
    () => attempt.questions.map((q, i) => (typeof answers[q.id] === "number" ? null : i + 1)).filter((n): n is number => n !== null),
    [attempt.questions, answers],
  );

  async function submit() {
    setSubmitting(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await apiFetch(`/api/assessments/${attempt.id}/submit`, { method: "POST", json: latest.current });
      toast.success("Assessment submitted");
      if (onSubmitted) onSubmitted();
      else router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Submission failed. Your answers are saved; try again.");
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  const doneCount = answeredCount + practicalCount;
  const section = question ? "Multiple choice" : "Practical";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
      <div className={cn("surface", "min-w-0 p-4 sm:p-5")}>
        <div className="mb-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              {!isReview && (
                <span className="rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {section}
                </span>
              )}
              <span className="font-semibold tabular-nums">{isReview ? "Review" : `Item ${index + 1} of ${total}`}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="tabular-nums">
                {doneCount}/{total} done
              </span>
              <SaveIndicator state={saveState} onRetry={() => void save()} />
            </div>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Assessment progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={doneCount}
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(doneCount / total) * 100}%` }} />
          </div>
        </div>

        {question && (
          <fieldset key={question.id}>
            <legend className="sr-only">Question {index + 1}</legend>
            <MetaRow items={[question.skillName, DIFFICULTY_LABEL[question.difficulty], `${question.points} ${question.points === 1 ? "point" : "points"}`]} />
            <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-xl font-semibold leading-snug outline-none">
              {question.text}
            </h2>
            <div className="mt-4 grid gap-2" role="radiogroup">
              {question.options.map((option, i) => {
                const selected = answers[question.id] === i;
                return (
                  <label
                    key={i}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      selected ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "bg-muted/30 hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={selected}
                      onChange={() => {
                        setAnswers((a) => {
                          const next = { ...a, [question.id]: i };
                          latest.current = { ...latest.current, answers: next };
                          return next;
                        });
                        scheduleSave();
                      }}
                      className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="flex-1 leading-snug">{option}</span>
                    {selected && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {challenge && (
          <section key={challenge.id} aria-labelledby="challenge-title">
            <MetaRow items={["Practical challenge", challenge.skillName, DIFFICULTY_LABEL[challenge.difficulty], `${challenge.maxPoints} points`]} />
            <h2 id="challenge-title" ref={headingRef} tabIndex={-1} className="mt-2 text-xl font-semibold leading-snug outline-none">
              {challenge.title}
            </h2>
            <p className="mt-2 whitespace-pre-line leading-snug text-foreground/85">{challenge.instructions}</p>
            <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Scale className="size-4 text-primary" aria-hidden /> How it is graded
              </p>
              <ul className="mt-2 grid gap-1 text-sm">
                {challenge.criteria.map((c) => (
                  <li key={c.key} className="flex justify-between gap-4">
                    <span className="leading-snug text-foreground/80">{c.description}</span>
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
                      {c.points} pts
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-xs leading-snug text-muted-foreground">
                Graded automatically by checking your answer for each criterion. Code is not executed. Leave it blank to
                skip; skipped challenges don&apos;t count toward that skill.
              </p>
            </div>
            <label htmlFor={`p-${challenge.id}`} className="mt-4 mb-1.5 block text-sm font-medium">
              Your answer
            </label>
            <Textarea
              id={`p-${challenge.id}`}
              rows={9}
              maxLength={5000}
              className="font-mono text-sm"
              value={practicals[challenge.id] ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setPracticals((p) => {
                  const next = { ...p, [challenge.id]: value };
                  latest.current = { ...latest.current, practicals: next };
                  return next;
                });
                scheduleSave();
              }}
            />
          </section>
        )}

        {isReview && (
          <section aria-labelledby="review-title">
            <h2 id="review-title" ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
              Ready to submit?
            </h2>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <ReviewStat
                icon={ListChecks}
                done={answeredCount}
                total={attempt.questions.length}
                label={`${answeredCount} of ${attempt.questions.length} questions answered`}
                note={unansweredNumbers.length > 0 ? `Unanswered: ${unansweredNumbers.join(", ")}` : undefined}
              />
              <ReviewStat
                icon={Code2}
                done={practicalCount}
                total={attempt.challenges.length}
                label={`${practicalCount} of ${attempt.challenges.length} practical challenges attempted`}
              />
            </ul>
            <p className="mt-3 max-w-prose text-sm leading-snug text-muted-foreground">
              Unanswered questions score zero. After you submit, answers are locked and you will see your per-skill
              results with explanations.
            </p>
            <Button className="mt-4" size="lg" onClick={() => setConfirmOpen(true)}>
              <Send aria-hidden /> Submit assessment
            </Button>
          </section>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            <ArrowLeft /> Previous
          </Button>
          {!isReview && (
            <Button onClick={() => setIndex((i) => Math.min(total, i + 1))}>
              {index === total - 1 ? "Review answers" : "Next"} <ArrowRight />
            </Button>
          )}
        </div>
      </div>

      <aside aria-label="Question navigator" className={cn("surface", "p-4 lg:sticky lg:top-20 lg:self-start")}>
        <div className="mb-2 flex items-center justify-between text-sm">
          <p className="font-medium">Questions</p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {answeredCount}/{attempt.questions.length}
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-5">
          {attempt.questions.map((q, i) => (
            <NavCell key={q.id} label={String(i + 1)} active={index === i} done={typeof answers[q.id] === "number"} onClick={() => setIndex(i)} />
          ))}
        </div>
        <div className="mt-3 mb-2 flex items-center justify-between text-sm">
          <p className="font-medium">Practical</p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {practicalCount}/{attempt.challenges.length}
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-5">
          {attempt.challenges.map((c, i) => (
            <NavCell
              key={c.id}
              label={`P${i + 1}`}
              active={index === attempt.questions.length + i}
              done={(practicals[c.id] ?? "").trim().length > 0}
              onClick={() => setIndex(attempt.questions.length + i)}
            />
          ))}
        </div>
        <Button variant={isReview ? "default" : "outline"} className="mt-3 w-full" onClick={() => setIndex(total)}>
          <Check /> Review & submit
        </Button>
      </aside>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !submitting && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              {unansweredNumbers.length > 0
                ? `${unansweredNumbers.length} question${unansweredNumbers.length === 1 ? " is" : "s are"} unanswered and will score zero. `
                : ""}
              You can&apos;t change answers after submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Keep working</AlertDialogCancel>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {submitting ? "Scoring…" : "Submit"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReviewStat({
  icon: Icon,
  done,
  total,
  label,
  note,
}: {
  icon: typeof ListChecks;
  done: number;
  total: number;
  label: string;
  note?: string;
}) {
  const complete = total > 0 && done === total;
  return (
    <li className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="leading-snug">{label}</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", complete ? "bg-strong" : "bg-primary")} style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
      </div>
      {note && <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{note}</p>}
    </li>
  );
}

function NavCell({ label, active, done, onClick }: { label: string; active: boolean; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      aria-label={`${label}${done ? ", answered" : ", not answered"}`}
      className={cn(
        "grid h-8 place-items-center rounded-md border text-xs font-medium tabular-nums outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring",
        done && "border-primary/50 bg-primary/20 text-primary",
        active && "border-primary bg-primary text-primary-foreground ring-2 ring-primary/40",
      )}
    >
      {label}
    </button>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-1" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" /> Saving
      </span>
    );
  if (state === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-primary" aria-live="polite">
        <Check className="size-3.5" aria-hidden /> Saved
      </span>
    );
  if (state === "error")
    return (
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-destructive underline-offset-4 hover:underline">
        <CloudOff className="size-3.5" /> Not saved, retry
      </button>
    );
  return null;
}

function MetaRow({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5 text-[11px] font-medium">
      {items.map((item, i) => (
        <li
          key={item}
          className={cn(
            "rounded-full border px-2 py-0.5",
            i === 0 ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground",
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
