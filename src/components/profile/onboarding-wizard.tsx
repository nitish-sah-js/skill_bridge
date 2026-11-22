"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Clock,
  Gauge,
  GraduationCap,
  Lightbulb,
  ListChecks,
  School,
  Target,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  EDUCATION_LEVELS,
  EXPERIENCE_LEVELS,
  LEARNING_PACES,
  onboardingStepSchemas,
  profileFieldsSchema,
} from "@/lib/validation/schemas";
import {
  AvailabilitySection,
  CareerSection,
  EducationSection,
  InterestsSection,
  PersonalSection,
  type CareerOption,
  type ProfileFormInput,
  type ProfileFormOutput,
} from "./profile-sections";

const STEPS = [
  { title: "About you", icon: UserRound, fields: ["full_name"] },
  {
    title: "Education & background",
    icon: GraduationCap,
    fields: ["education_level", "experience_level", "institution", "graduation_year"],
  },
  { title: "Interests & current skills", icon: Lightbulb, fields: ["interests", "current_skills"] },
  { title: "Target career", icon: Target, fields: ["target_career_id"] },
  { title: "Learning availability", icon: Clock, fields: ["weekly_learning_hours", "learning_pace", "learning_goals"] },
  { title: "Review", icon: ListChecks, fields: [] },
] as const satisfies readonly { title: string; icon: LucideIcon; fields: readonly (keyof ProfileFormInput)[] }[];


export function OnboardingWizard({
  initial,
  initialStep,
  careers,
  skillSuggestions,
}: {
  initial: Partial<ProfileFormInput>;
  initialStep: number;
  careers: CareerOption[];
  skillSuggestions: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), STEPS.length));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ProfileFormInput, unknown, ProfileFormOutput>({
    resolver: zodResolver(profileFieldsSchema),
    defaultValues: { interests: [], current_skills: [], institution: "", learning_goals: "", graduation_year: null, ...initial },
    mode: "onTouched",
  });

  const current = STEPS[step - 1];

  /** Validate this step, save its fields, and move on. Progress persists if the student leaves. */
  async function next() {
    setError(null);
    const fields = current.fields;
    if (!(await form.trigger(fields))) return;
    const parsed = onboardingStepSchemas[step as keyof typeof onboardingStepSchemas].safeParse(form.getValues());
    if (!parsed.success) return;
    setSaving(true);
    try {
      await apiFetch("/api/profile", { method: "PATCH", json: { ...parsed.data, onboarding_step: step + 1 } });
      setStep(step + 1);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/profile", { method: "PATCH", json: { complete_onboarding: true } });
      toast.success("Profile saved. Time to measure your skills.");
      router.push("/assessment");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not save. Try again.");
      setSaving(false);
    }
  }

  const values = useWatch({ control: form.control });
  const career = careers.find((c) => c.id === values.target_career_id);
  const label = <T extends { value: string; label: string }>(list: readonly T[], v: unknown) =>
    list.find((o) => o.value === v)?.label ?? "Not set";

  const percent = Math.round(((step - 1) / (STEPS.length - 1)) * 100);
  const StepIcon = current.icon;

  return (
    <div className="grid gap-4">
      <nav aria-label="Onboarding steps" className={cn("surface", "p-3 sm:p-4")}>
        <div className="relative">
          {/* Track runs between the first and last step centres (each step is 1/6 wide). */}
          <div aria-hidden className="absolute top-4 right-[8.333%] left-[8.333%] h-0.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
          <ol className="relative grid grid-cols-6">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <li key={s.title} className="flex justify-center">
                  <button
                    type="button"
                    disabled={n > step}
                    onClick={() => setStep(n)}
                    aria-current={active ? "step" : undefined}
                    className="group flex flex-col items-center gap-1.5 rounded-md px-1 text-center text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full border bg-card text-xs font-semibold tabular-nums transition-colors",
                        active && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                        done && "border-primary bg-primary/15 text-primary group-hover:bg-primary/25",
                        !active && !done && "text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-4" aria-hidden /> : n}
                    </span>
                    <span
                      className={cn(
                        "sr-only leading-tight md:not-sr-only",
                        active ? "font-medium text-foreground" : done ? "text-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {s.title}
                    </span>
                    {done && <span className="sr-only"> (completed)</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      <section aria-labelledby="step-title" className={cn("surface", "p-4 sm:p-5")}>
        <div className="mb-4 flex items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30"
            aria-hidden
          >
            <StepIcon className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">
              Step {step} of {STEPS.length}
            </p>
            <h2 id="step-title" className="text-lg leading-snug font-semibold">
              {current.title}
            </h2>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (step === STEPS.length ? finish() : next());
          }}
          noValidate
        >
          {step === 1 && <PersonalSection form={form} />}
          {step === 2 && <EducationSection form={form} />}
          {step === 3 && <InterestsSection form={form} skillSuggestions={skillSuggestions} />}
          {step === 4 && <CareerSection form={form} careers={careers} />}
          {step === 5 && <AvailabilitySection form={form} />}
          {step === 6 && (
            <dl className="grid gap-2.5 sm:grid-cols-2">
              <ReviewItem icon={UserRound} label="Name" value={values.full_name || "Not set"} />
              <ReviewItem icon={GraduationCap} label="Education" value={label(EDUCATION_LEVELS, values.education_level)} />
              <ReviewItem icon={Gauge} label="Experience" value={label(EXPERIENCE_LEVELS, values.experience_level)} />
              <ReviewItem icon={School} label="Institution" value={values.institution || "Not set"} />
              <ReviewItem icon={Lightbulb} label="Interests" value={values.interests?.join(", ") || "None added"} />
              <ReviewItem icon={Wrench} label="Current skills" value={values.current_skills?.join(", ") || "None added"} />
              <ReviewItem icon={Target} label="Target career" value={career?.name ?? "Not set"} />
              <ReviewItem
                icon={Clock}
                label="Availability"
                value={`${values.weekly_learning_hours ?? "?"} h/week, ${label(LEARNING_PACES, values.learning_pace).toLowerCase()} pace`}
              />
            </dl>
          )}
          {step === 6 && (
            <p className="mt-3 flex gap-2 rounded-lg border border-primary/30 bg-accent/30 p-3 text-sm leading-snug">
              <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                Next: a {career ? career.name : "career"} assessment with 20 questions and 2 short practical challenges,
                about 30 minutes. You can pause and resume.
              </span>
            </p>
          )}

          <div className="mt-5 flex items-center gap-3 border-t pt-4">
            {step > 1 && (
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)} disabled={saving}>
                <ArrowLeft /> Back
              </Button>
            )}
            <Button type="submit" size="lg" className="ml-auto" disabled={saving}>
              {saving ? "Saving…" : step === STEPS.length ? "Save and start assessment" : "Continue"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReviewItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border bg-background/40 p-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm leading-snug font-medium break-words">{value}</dd>
      </div>
    </div>
  );
}
