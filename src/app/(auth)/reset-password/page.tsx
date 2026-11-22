import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { getCurrentUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Link expired</h1>
        <p className="mt-2 text-muted-foreground">Open the latest reset link from your email, or request a new one.</p>
        <Link href="/forgot-password" className="mt-6 inline-block text-primary underline-offset-4 hover:underline">
          Request a new link
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <p className="mt-1 mb-6 text-muted-foreground">For {user.email}.</p>
      <ResetPasswordForm />
    </>
  );
}
