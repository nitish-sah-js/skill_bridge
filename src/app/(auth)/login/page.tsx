import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { ConfigNotice } from "@/components/layout/config-notice";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 mb-6 text-muted-foreground">Pick up where you left off.</p>
      <ConfigNotice />
      <LoginForm next={next} linkError={params.error === "link"} />
      <p className="mt-6 text-sm text-muted-foreground">
        New to SkillBridge?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
