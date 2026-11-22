import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <Logo />
      <div className="surface p-5">
        <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
          <Compass className="size-5" aria-hidden />
        </span>
        <h1 className="mt-3 text-2xl font-semibold">Page not found</h1>
        <p className="mt-1 leading-snug text-muted-foreground">
          The page may have moved, or the link may belong to another account.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Go to dashboard
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
