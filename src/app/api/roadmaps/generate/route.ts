import { handle } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { generateRoadmapForUser } from "@/features/roadmap/service";

/** Generate a new six-week roadmap; the previous one is archived with its completed work. */
export async function POST() {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    const { roadmapId } = await generateRoadmapForUser(supabase, user.id);
    return { roadmapId };
  }, 201);
}
