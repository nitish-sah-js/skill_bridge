import { handle } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { getProgressReport } from "@/features/progress/service";

export async function GET() {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    return getProgressReport(supabase, user.id);
  });
}
