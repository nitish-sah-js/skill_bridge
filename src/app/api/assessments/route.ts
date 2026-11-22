import { handle, readJson } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { listAttempts, startAssessment } from "@/features/assessments/service";
import { startAssessmentSchema } from "@/lib/validation/schemas";

export async function GET() {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    return listAttempts(supabase, user.id);
  });
}

/** Start a new attempt for a career, or resume the open one. */
export async function POST(request: Request) {
  return handle(async () => {
    const { user } = await requireApiUser();
    const { careerId } = await readJson(request, startAssessmentSchema);
    return startAssessment(user.id, careerId);
  }, 201);
}
