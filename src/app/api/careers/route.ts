import { handle } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { listCareers } from "@/features/careers/service";

export async function GET() {
  return handle(async () => listCareers(await createClient()));
}
