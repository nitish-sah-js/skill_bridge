import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FolderGit2, GitBranch, GraduationCap, Layers, ListChecks, Star, type LucideIcon } from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { getCareer } from "@/features/careers/service";
import { getProfile } from "@/features/profiles/service";
import { AppError } from "@/lib/api/errors";
import { PageHeader } from "@/components/layout/page-header";
import { SetTargetCareerButton, StartAssessmentButton } from "@/components/careers/career-actions";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Career" };

function importanceLabel(weight: number) {
  if (weight >= 1.2) return "Core";
  if (weight >= 0.9) return "Important";
  return "Supporting";
}

const IMPORTANCE_PILL: Record<ReturnType<typeof importanceLabel>, string> = {
  Core: "border-primary/50 bg-primary/15 text-primary",
  Important: "border-border bg-accent text-accent-foreground",
  Supporting: "border-border bg-muted text-muted-foreground",
};


function IconBadge({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30", className)}>
      <Icon className="size-4.5" aria-hidden />
    </span>
  );
}

function AsidePanel({ id, title, icon, children }: { id: string; title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn("surface", "p-4")}>
      <div className="flex items-center gap-2.5">
        <IconBadge icon={icon} />
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-1.5 text-sm leading-snug text-foreground/80">
      {items.map((r) => (
        <li key={r} className="flex gap-2">
          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
          {r}
        </li>
      ))}
    </ul>
  );
}

export default async function CareerDetailPage({ params }: PageProps<"/careers/[slug]">) {
  const { slug } = await params;
  const { user, supabase } = await requireUser(`/careers/${slug}`);
  const profile = await getProfile(supabase, user.id);
  const career = await getCareer(supabase, slug).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const isTarget = profile.target_career_id === career.id;
  const skillName = new Map(career.skills.map((s) => [s.skillId, s.name]));
  const coreCount = career.skills.filter((s) => importanceLabel(s.importanceWeight) === "Core").length;
  const stats: { label: string; value: number; icon: LucideIcon }[] = [
    { label: "Required skills", value: career.skills.length, icon: Layers },
    { label: "Core skills", value: coreCount, icon: Star },
    { label: "Portfolio projects", value: career.suggestedProjects.length, icon: FolderGit2 },
  ];

  return (
    <>
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/careers" />}>Careers</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{career.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title={career.name}
        description={career.description}
        actions={
          <>
            <SetTargetCareerButton careerId={career.id} careerName={career.name} isTarget={isTarget} size="lg" />
            {isTarget && <StartAssessmentButton careerId={career.id} size="lg" />}
          </>
        }
      />

      <ul className="mb-4 grid grid-cols-3 gap-3">
        {stats.map(({ label, value, icon }) => (
          <li key={label} className={cn("surface", "flex items-center gap-3 p-3 sm:p-4")}>
            <IconBadge icon={icon} className="hidden sm:flex" />
            <div className="min-w-0">
              <p className="text-2xl leading-none font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{label}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="skills-heading" className={cn("surface", "overflow-hidden")}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-3">
            <h2 id="skills-heading" className="text-lg font-semibold">
              Required skills
            </h2>
            <p className="text-xs leading-snug text-muted-foreground">
              Targets are SkillBridge&apos;s editable starting values on a 0–100 scale, not industry standards.
            </p>
          </div>
          <ul>
            {career.skills.map((s) => {
              const prereqs = career.dependencies
                .filter((d) => d.dependentSkillId === s.skillId)
                .map((d) => skillName.get(d.prerequisiteSkillId))
                .filter(Boolean);
              const importance = importanceLabel(s.importanceWeight);
              return (
                <li key={s.skillId} className="grid gap-2.5 border-t px-4 py-3 first:border-t-0 sm:grid-cols-[1fr_150px] sm:items-start sm:gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", IMPORTANCE_PILL[importance])}>
                        {importance}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm leading-snug text-foreground/75">{s.description}</p>
                    {prereqs.length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <GitBranch className="size-3 shrink-0" aria-hidden /> Builds on {prereqs.join(", ")}
                      </p>
                    )}
                    {s.resources.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {s.resources.slice(0, 2).map((r) => (
                          <li key={r.url}>
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-2 py-0.5 text-xs text-primary transition-colors outline-none hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              {r.title} <ExternalLink className="size-3" aria-hidden />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                      <span>Target</span>
                      <span className="text-base font-semibold text-foreground tabular-nums">{s.requiredProficiency}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-target" style={{ width: `${s.requiredProficiency}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="grid content-start gap-3">
          <AsidePanel id="resp-heading" title="What you would do" icon={ListChecks}>
            <BulletList items={career.responsibilities} />
          </AsidePanel>
          <AsidePanel id="pre-heading" title="Good starting points" icon={GraduationCap}>
            <BulletList items={career.prerequisites} />
          </AsidePanel>
          <AsidePanel id="proj-heading" title="Portfolio projects" icon={FolderGit2}>
            <ul className="grid gap-2 text-sm">
              {career.suggestedProjects.map((p) => (
                <li key={p.title} className="rounded-lg border bg-muted/40 px-3 py-2">
                  <div className="font-medium">{p.title}</div>
                  <div className="leading-snug text-foreground/75">{p.description}</div>
                </li>
              ))}
            </ul>
          </AsidePanel>
        </aside>
      </div>
    </>
  );
}
