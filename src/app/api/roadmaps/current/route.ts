import { handle } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { getCurrentRoadmap } from "@/features/roadmap/service";

export async function GET() {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    return getCurrentRoadmap(supabase, user.id);
  });
}
