"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bot,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  Map,
  Menu,
  Target,
  UserRound,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ParticleWave } from "./particle-wave";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/careers", label: "Careers", icon: Compass },
  { href: "/assessment", label: "Assessment", icon: ClipboardCheck },
  { href: "/skill-gap", label: "Skill gap", icon: Target },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/mentor", label: "AI mentor", icon: Bot },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active &&
                "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary [&>svg]:text-sidebar-primary",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarNav() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-hidden border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
      <ParticleWave className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full opacity-35 [mask-image:linear-gradient(to_top,black,transparent)]" />
      <Link href="/dashboard" className="relative px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-md">
        <Logo inverted />
      </Link>
      <div className="relative">
        <NavLinks />
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" />}>
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-4 text-sidebar-foreground">
        <SheetTitle className="px-3 text-white">
          <Logo inverted />
        </SheetTitle>
        <NavLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
