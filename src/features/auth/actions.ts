"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, registerSchema } from "@/lib/validation/schemas";
import { safeNextPath } from "./redirects";

export type AuthActionResult = { error?: string; message?: string };

function authErrorMessage(error: { code?: string; message: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email address first. Check your inbox for the confirmation link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "weak_password":
      return "Choose a stronger password (at least 8 characters, mixing letters and numbers).";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    default:
      console.error("[auth]", error.code ?? error.status ?? "", error.message);
      return "Authentication failed. Please try again.";
  }
}

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signIn(input: { email: string; password: string; next?: string }): Promise<AuthActionResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error) };
  redirect(safeNextPath(input.next) ?? "/dashboard");
}

export async function signUp(input: { email: string; password: string; fullName: string }): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: z.prettifyError(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: authErrorMessage(error) };
  // With email confirmation enabled Supabase returns no session until the link is clicked.
  if (!data.session) {
    return { message: `We sent a confirmation link to ${parsed.data.email}. Open it to activate your account.` };
  }
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(input: { email: string }): Promise<AuthActionResult> {
  const parsed = credentialsSchema.pick({ email: true }).safeParse(input);
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error && error.code?.startsWith("over_")) return { error: authErrorMessage(error) };
  // Same response whether or not the account exists, to avoid revealing registered emails.
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(input: { password: string }): Promise<AuthActionResult> {
  const parsed = credentialsSchema.pick({ password: true }).safeParse(input);
  if (!parsed.success) return { error: "Use at least 8 characters." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };
  redirect("/dashboard");
}
