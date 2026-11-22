import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getProfile } from "@/features/profiles/service";
import { MobileNav, SidebarNav } from "@/components/layout/app-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/layout/logo";

/** Authenticated app shell. The session is verified server-side on every request. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, supabase } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  if (!profile.onboarding_completed) redirect("/onboarding");

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-primary/20 bg-background/85 px-4 shadow-[0_1px_20px_-10px_var(--primary)] backdrop-blur-xl sm:px-6">
          <MobileNav />
          <span className="lg:hidden">
            <Logo />
          </span>
          <div className="ml-auto">
            <UserMenu name={profile.full_name} email={user.email ?? ""} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
