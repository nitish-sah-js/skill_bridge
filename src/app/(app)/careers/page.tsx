import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, ChevronRight, ClipboardCheck, Layers } from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { listCareers } from "@/features/careers/service";
import { getProfile } from "@/features/profiles/service";
import { PageHeader } from "@/components/layout/page-header";
import { SetTargetCareerButton } from "@/components/careers/career-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Careers" };

export default async function CareersPage() {
  const { user, supabase } = await requireUser("/careers");
  const [careers, profile] = await Promise.all([listCareers(supabase), getProfile(supabase, user.id)]);

  return (
    <>
      <PageHeader
        title="Career explorer"
        description="Each career lists the skills it needs and the proficiency SkillBridge uses as its target."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
            <BriefcaseBusiness className="size-3.5" aria-hidden />
            {careers.length} {careers.length === 1 ? "career" : "careers"}
          </span>
        }
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {careers.map((c) => {
          const isTarget = profile.target_career_id === c.id;
          return (
            <li
              key={c.id}
              className={cn(
                "flex flex-col surface p-4 transition-colors hover:border-primary/50",
                isTarget && "border-primary/60 ring-1 ring-primary/30",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                  <BriefcaseBusiness className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base leading-snug font-semibold">
                    <Link href={`/careers/${c.slug}`} className="rounded-sm outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50">
                      {c.name}
                    </Link>
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Layers className="size-3" aria-hidden />
                      {c.skillCount} skills
                    </span>
                    {isTarget && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Your target</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-2.5 flex-1 text-sm leading-snug text-foreground/80">{c.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                {isTarget ? (
                  <Link href="/assessment" className={buttonVariants({ size: "sm" })}>
                    <ClipboardCheck aria-hidden /> Go to assessment
                  </Link>
                ) : (
                  <SetTargetCareerButton careerId={c.id} careerName={c.name} isTarget={false} size="sm" variant="default" />
                )}
                <Link href={`/careers/${c.slug}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto text-primary")}>
                  View details <ChevronRight aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
