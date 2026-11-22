import { handle } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { getSkillGapReport } from "@/features/skill-gap/service";

export async function GET() {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    return getSkillGapReport(supabase, user.id);
  });
}
