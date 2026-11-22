"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Clock, GraduationCap, Lightbulb, Save, Target, UserRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { profileFieldsSchema } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";
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

export function ProfileForm({
  initial,
  careers,
  skillSuggestions,
}: {
  initial: ProfileFormInput;
  careers: CareerOption[];
  skillSuggestions: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ProfileFormInput, unknown, ProfileFormOutput>({
    resolver: zodResolver(profileFieldsSchema),
    defaultValues: initial,
  });
  const careerChanged = useWatch({ control: form.control, name: "target_career_id" }) !== initial.target_career_id;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiFetch("/api/profile", { method: "PATCH", json: values });
      form.reset(form.getValues());
      toast.success("Profile saved");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not save your profile.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-4xl gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <ProfileCard id="p-personal" icon={UserRound} title="About you">
          <PersonalSection form={form} />
        </ProfileCard>
        <ProfileCard id="p-education" icon={GraduationCap} title="Education & background">
          <EducationSection form={form} />
        </ProfileCard>
      </div>
      <ProfileCard id="p-interests" icon={Lightbulb} title="Interests & current skills">
        <InterestsSection form={form} skillSuggestions={skillSuggestions} />
      </ProfileCard>
      <ProfileCard id="p-career" icon={Target} title="Target career">
        <CareerSection form={form} careers={careers} />
        {careerChanged && (
          <Alert className="border-developing/40 bg-developing/10">
            <AlertDescription>
              Changing your target career switches your skill-gap analysis to the new career. Skills you have already
              been assessed on carry over; take the new career&apos;s assessment to measure the rest.
            </AlertDescription>
          </Alert>
        )}
      </ProfileCard>
      <ProfileCard id="p-availability" icon={Clock} title="Learning availability">
        <AvailabilitySection form={form} />
      </ProfileCard>
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-primary/20 bg-background/95 px-4 py-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
          <Save />
          {form.formState.isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        {form.formState.isDirty && (
          <span className="inline-flex items-center gap-1.5 text-sm text-developing">
            <span className="size-2 rounded-full bg-developing" aria-hidden />
            Unsaved changes
          </span>
        )}
      </div>
    </form>
  );
}

function ProfileCard({
  id,
  icon: Icon,
  title,
  className,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "grid content-start gap-4 surface p-4",
        className,
      )}
    >
      <h2 id={id} className="flex items-center gap-2.5 font-semibold">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30" aria-hidden>
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
