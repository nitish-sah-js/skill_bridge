import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isMentorConfigured } from "@/lib/ai/provider";

/** Liveness plus configuration status (booleans only, never secrets). */
export function GET() {
  return NextResponse.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    serverKeyConfigured: Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    mentorConfigured: isMentorConfigured(),
  });
}
