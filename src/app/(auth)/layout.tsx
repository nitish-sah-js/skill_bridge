import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ParticleBackdrop } from "@/components/layout/particle-wave";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // Same dark particle backdrop as the landing page; `dark` swaps the design tokens for the forms.
    <div className="dark relative isolate flex min-h-dvh flex-col bg-[#050907] text-foreground [color-scheme:dark]">
      <ParticleBackdrop />
      <header className="px-6 py-5">
        <Link
          href="/"
          aria-label="SkillBridge home"
          className="inline-flex rounded-md text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo inverted />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-sm rounded-xl border border-white/12 border-t-emerald-400/40 bg-[#0c1611]/90 p-6 shadow-[0_24px_64px_-16px_rgb(0_0_0/0.9),0_0_40px_rgb(52_211_153/0.08)] backdrop-blur-md">
          {children}
        </div>
      </main>
    </div>
  );
}
