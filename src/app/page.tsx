import Link from "next/link";
import { connection } from "next/server";
import { BenchmarkPreview } from "@/components/landing/benchmark-preview";
import { Logo } from "@/components/layout/logo";
import { ParticleBackdrop } from "@/components/layout/particle-wave";
import { getCurrentUser } from "@/features/auth/session";
import { listCareers, type CareerSummary } from "@/features/careers/service";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Assess", body: "20 questions and 2 practical challenges measure each skill your target career needs." },
  { title: "Analyze", body: "Every skill is compared with its target. Gaps are ranked by size, importance and what they unlock." },
  { title: "Personalize", body: "A six-week plan puts foundations first and never schedules more than your weekly hours." },
  { title: "Learn", body: "Work through tasks, practise, and ask an AI mentor that knows your level and your gaps." },
  { title: "Measure", body: "A follow-up assessment records how each skill changed, so progress is evidence, not guesswork." },
];

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
const primaryCta = cn(
  "inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-emerald-300 via-emerald-200 to-teal-200 px-6 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgb(52_211_153/0.3)] transition hover:from-white hover:to-emerald-200",
  focusRing,
);
const headerCta = cn(
  "rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-emerald-950 shadow-[0_0_20px_rgb(52_211_153/0.45)] ring-1 ring-emerald-300/60 transition hover:bg-emerald-300 hover:shadow-[0_0_28px_rgb(52_211_153/0.6)]",
  focusRing,
);
const navLink = cn(
  "relative rounded-md py-1 text-zinc-200 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-emerald-400 after:transition-transform hover:text-emerald-300 hover:after:scale-x-100",
  focusRing,
);
const secondaryCta = cn(
  "inline-flex items-center rounded-xl border border-white/10 bg-zinc-900/60 px-6 py-3.5 text-sm font-medium text-zinc-200 backdrop-blur-md transition hover:border-white/25 hover:bg-zinc-800/80",
  focusRing,
);

async function loadCareers(): Promise<CareerSummary[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    return await listCareers(await createClient());
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  await connection();
  const [user, careers] = await Promise.all([isSupabaseConfigured() ? getCurrentUser() : null, loadCareers()]);

  return (
    // Landing is always dark so the particle backdrop reads; `dark` swaps the design tokens for this subtree.
    <div className="dark relative isolate min-h-dvh overflow-x-clip bg-[#050907] text-zinc-100 [color-scheme:dark]">
      <ParticleBackdrop />

      <header className="sticky top-0 z-50 border-b border-emerald-400/20 bg-[#050907]/80 shadow-[0_1px_24px_-8px_rgb(52_211_153/0.25)] backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="SkillBridge home" className={cn("rounded-md text-white", focusRing)}>
            <Logo inverted />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-8 text-[15px] font-medium md:flex">
            <a href="#how" className={navLink}>
              How it works
            </a>
            {careers.length > 0 && (
              <a href="#careers" className={navLink}>
                Career paths
              </a>
            )}
            <a href="#baseline" className={navLink}>
              Honest baseline
            </a>
          </nav>
          <nav aria-label="Account" className="flex items-center gap-5 text-sm">
            {user ? (
              <Link href="/dashboard" className={headerCta}>
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className={cn("rounded-md font-medium text-white transition-colors hover:text-emerald-300", focusRing)}>
                  Sign in
                </Link>
                <Link href="/register" className={headerCta}>
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-16 pb-24 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:py-28">
          <div>
            <h1 className="max-w-xl text-4xl leading-[1.08] font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.65rem]">
              Know exactly how far you are from the tech job you want.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
              SkillBridge measures your skills against a real career&apos;s requirements, shows the gaps that matter most,
              and gives you a six-week plan to close them.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href={user ? "/dashboard" : "/register"} className={primaryCta}>
                {user ? "Continue learning" : "Take the free assessment"}
              </Link>
              <a href="#how" className={secondaryCta}>
                How it works
              </a>
            </div>
            <ul className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/8 pt-6 text-sm text-zinc-400">
              <li className="flex items-center gap-2">
                <span aria-hidden className="size-2 rounded-full bg-strong" />
                20 questions and 2 practical challenges
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="size-2 rounded-full bg-target" />
                Unassessed skills are never scored as zero
              </li>
            </ul>
          </div>

          <div className="flex justify-center lg:justify-end">
            <BenchmarkPreview />
          </div>
        </section>

        <section id="how" className="scroll-mt-20 border-t border-white/7 bg-[#050907]/40 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              From a guess to a plan in one sitting
            </h2>
            <div className="relative mt-8">
              <div aria-hidden className="absolute top-[29px] right-[8%] left-[8%] hidden h-px bg-linear-to-r from-emerald-400/30 via-teal-400/60 to-emerald-400/30 lg:block" />
              <ol className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {STEPS.map((step, i) => (
                  <li
                    key={step.title}
                    className="rounded-xl border border-white/12 border-t-emerald-400/40 bg-[#0c1611]/90 p-4 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.8)] backdrop-blur-md"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/15 font-mono text-xs font-bold text-emerald-200 tabular-nums">
                        {i + 1}
                      </span>
                      <h3 className="text-base font-bold text-white">{step.title}</h3>
                    </div>
                    <p className="mt-2.5 text-sm leading-snug text-zinc-300">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {careers.length > 0 && (
          <section id="careers" className="scroll-mt-20 border-t border-white/7 py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Career paths</h2>
              <p className="mt-2 max-w-xl text-zinc-300">Pick one when you sign up. You can switch later.</p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {careers.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-white/12 border-t-emerald-400/40 bg-[#0c1611]/90 p-4 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.8)] backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-white">{c.name}</h3>
                      <span className="shrink-0 rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] text-emerald-200 tabular-nums">
                        {c.skillCount} skills
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-snug text-zinc-300">{c.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section id="baseline" className="scroll-mt-20 pb-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="relative flex flex-col gap-5 overflow-hidden rounded-xl border border-emerald-400/30 bg-linear-to-br from-emerald-500/15 via-[#0c1611]/95 to-[#0c1611]/95 p-6 shadow-[0_0_48px_rgb(52_211_153/0.1)] backdrop-blur-md sm:p-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Start with an honest baseline</h2>
                <p className="mt-2 leading-snug text-zinc-300">
                  Unassessed skills stay “unknown”, never zero, and your readiness indicator says what it does and
                  doesn&apos;t cover.
                </p>
              </div>
              <Link href={user ? "/dashboard" : "/register"} className={cn(primaryCta, "shrink-0 self-start md:self-auto")}>
                {user ? "Open dashboard" : "Create a free account"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 bg-[#050907]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm sm:flex-row sm:px-6">
          <Logo inverted className="text-white" />
          <p className="text-center text-zinc-400 sm:text-right">
            Skill targets are editable starting values, not industry standards.
          </p>
        </div>
      </footer>
    </div>
  );
}
