import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ConfigurationError, getPublicSupabaseEnv } from "@/lib/env";

/**
 * Privileged client that bypasses RLS. Use only in server code, only after the caller's
 * identity and ownership have been verified, and only for operations clients may not do
 * themselves (reading answer keys, persisting scores, writing roadmaps and mentor replies).
 */
export function createAdminClient() {
  const { url } = getPublicSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new ConfigurationError("SUPABASE_SECRET_KEY is not set (see .env.example).");
  }
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
