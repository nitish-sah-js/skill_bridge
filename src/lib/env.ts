import { z } from "zod";

/**
 * Public Supabase configuration (safe for the browser). Accepts the current
 * publishable-key name and falls back to the legacy anon-key name.
 */
export function getPublicSupabaseEnv(): { url: string; publishableKey: string } {
  const parsed = z
    .object({ url: z.string().url(), publishableKey: z.string().min(20) })
    .safeParse({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  if (!parsed.success) {
    throw new ConfigurationError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return parsed.data;
}

export function isSupabaseConfigured(): boolean {
  try {
    getPublicSupabaseEnv();
    return true;
  } catch {
    return false;
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}
