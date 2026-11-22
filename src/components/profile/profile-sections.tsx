"use client";

import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, nativeSelectClass } from "@/components/forms/field";
import { TagInput } from "@/components/forms/tag-input";
import { cn } from "@/lib/utils";
import { Briefcase, Check } from "lucide-react";
import {
  EDUCATION_LEVELS,
  EXPERIENCE_LEVELS,
  LEARNING_PACES,
  type profileFieldsSchema,
} from "@/lib/validation/schemas";

export type ProfileFormInput = z.input<typeof profileFieldsSchema>;
export type ProfileFormOutput = z.output<typeof profileFieldsSchema>;
export type ProfileForm = UseFormReturn<ProfileFormInput, unknown, ProfileFormOutput>;
export type CareerOption = { id: string; name: string; description: string; skillCount: number };

const INTEREST_SUGGESTIONS = [
  "Building apps",
  "Security",
  "Data & analytics",
  "Artificial intelligence",
  "Web design",
  "Problem solving",
  "Automation",
  "Open source",
];

const describedBy = (id: string, error?: unknown) => (error ? `${id}-error` : undefined);

export function PersonalSection({ form }: { form: ProfileForm }) {
  const error = form.formState.errors.full_name?.message;
  return (
    <Field id="full_name" label="Full name" error={error}>
      <Input id="full_name" autoComplete="name" aria-invalid={!!error} aria-describedby={describedBy("full_name", error)} {...form.register("full_name")} />
    </Field>
  );
}

export function EducationSection({ form }: { form: ProfileForm }) {
  const e = form.formState.errors;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id="education_level" label="Education level" error={e.education_level?.message}>
        <select id="education_level" className={nativeSelectClass} aria-invalid={!!e.education_level} {...form.register("education_level")}>
          <option value="">Select…</option>
          {EDUCATION_LEVELS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="experience_level" label="Technical experience" error={e.experience_level?.message}>
        <select id="experience_level" className={nativeSelectClass} aria-invalid={!!e.experience_level} {...form.register("experience_level")}>
          <option value="">Select…</option>
          {EXPERIENCE_LEVELS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="institution" label="Institution" optional error={e.institution?.message}>
        <Input id="institution" autoComplete="organization" {...form.register("institution")} />
      </Field>
      <Field id="graduation_year" label="Graduation year" optional error={e.graduation_year?.message}>
        <Input
          id="graduation_year"
          inputMode="numeric"
          placeholder="e.g. 2027"
          {...form.register("graduation_year", {
            setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v)),
          })}
        />
      </Field>
    </div>
  );
}

export function InterestsSection({ form, skillSuggestions }: { form: ProfileForm; skillSuggestions: string[] }) {
  const e = form.formState.errors;
  return (
    <div className="grid gap-4">
      <Field id="interests" label="What interests you?" error={e.interests?.message}>
        <Controller
          control={form.control}
          name="interests"
          render={({ field }) => (
            <TagInput id="interests" value={field.value ?? []} onChange={field.onChange} suggestions={INTEREST_SUGGESTIONS} placeholder="Type an interest and press Enter" />
          )}
        />
      </Field>
      <Field
        id="current_skills"
        label="Skills you already have"
        hint="Self-reported. Your assessment measures actual proficiency."
        error={e.current_skills?.message}
      >
        <Controller
          control={form.control}
          name="current_skills"
          render={({ field }) => (
            <TagInput id="current_skills" value={field.value ?? []} onChange={field.onChange} suggestions={skillSuggestions} placeholder="e.g. Python, Excel" />
          )}
        />
      </Field>
    </div>
  );
}

export function CareerSection({ form, careers }: { form: ProfileForm; careers: CareerOption[] }) {
  const error = form.formState.errors.target_career_id?.message;
  const selected = useWatch({ control: form.control, name: "target_career_id" });
  return (
    <fieldset>
      <legend className="sr-only">Target career</legend>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {careers.map((c) => {
          const active = selected === c.id;
          return (
            <label
              key={c.id}
              className={cn(
                "relative flex cursor-pointer gap-3 rounded-lg border bg-card p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                active ? "border-primary bg-accent/50 ring-1 ring-primary/40" : "hover:border-primary/50 hover:bg-accent/20",
              )}
            >
              <input type="radio" value={c.id} className="sr-only" {...form.register("target_career_id")} />
              <span
                className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ring-1 transition-colors",
                  active ? "bg-primary text-primary-foreground ring-primary" : "bg-primary/10 text-primary ring-primary/30",
                )}
                aria-hidden
              >
                {active ? <Check className="size-4" /> : <Briefcase className="size-4" />}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="font-medium leading-snug">{c.name}</span>
                <span className="text-sm leading-snug text-muted-foreground">{c.description}</span>
                <span className="mt-1 w-fit rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                  {c.skillCount} skills measured
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function AvailabilitySection({ form }: { form: ProfileForm }) {
  const e = form.formState.errors;
  const pace = useWatch({ control: form.control, name: "learning_pace" });
  return (
    <div className="grid gap-4">
      <Field id="weekly_learning_hours" label="Hours per week for learning" hint="Your roadmap never schedules more than this." error={e.weekly_learning_hours?.message}>
        <Input
          id="weekly_learning_hours"
          type="number"
          min={1}
          max={60}
          className="w-32"
          aria-invalid={!!e.weekly_learning_hours}
          {...form.register("weekly_learning_hours", { valueAsNumber: true })}
        />
      </Field>
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="mb-1.5 text-sm font-medium">Learning pace</legend>
        {LEARNING_PACES.map((p) => (
          <label
            key={p.value}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-lg border bg-card p-2.5 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              pace === p.value ? "border-primary bg-accent/50 ring-1 ring-primary/40" : "hover:border-primary/50",
            )}
          >
            <input type="radio" value={p.value} className="mt-1 accent-[var(--primary)]" {...form.register("learning_pace")} />
            <span>
              <span className="block text-sm font-medium">{p.label}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{p.description}</span>
            </span>
          </label>
        ))}
        {e.learning_pace && (
          <p role="alert" className="text-sm text-destructive sm:col-span-3">
            Choose a pace.
          </p>
        )}
      </fieldset>
      <Field id="learning_goals" label="Your goals" optional hint="The AI mentor uses this to tailor explanations." error={e.learning_goals?.message}>
        <Textarea id="learning_goals" rows={3} placeholder="e.g. Land a SOC analyst internship next summer" {...form.register("learning_goals")} />
      </Field>
    </div>
  );
}
