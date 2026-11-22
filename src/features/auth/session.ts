import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/api/errors";
import { isSupabaseConfigured } from "@/lib/env";

/** Verified user for this request (validated with Supabase Auth, not just the cookie). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  await cookies();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** For pages: redirect to login when there is no verified session. */
export async function requireUser(nextPath?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  const supabase = await createClient();
  return { user, supabase };
}

/** For route handlers: throw a 401 AppError when there is no verified session. */
export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  const supabase = await createClient();
  return { user, supabase };
}
