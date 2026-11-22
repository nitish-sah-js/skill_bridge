import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1 mb-6 text-muted-foreground">We will email you a link to choose a new one.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
