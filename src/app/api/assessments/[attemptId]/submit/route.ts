import type { NextRequest } from "next/server";
import { handle, readJson, uuidParam } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { submitAssessment } from "@/features/assessments/service";
import { submitAssessmentSchema } from "@/lib/validation/schemas";

/** Score MCQs and practical challenges server-side and persist the results atomically. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/assessments/[attemptId]/submit">) {
  return handle(async () => {
    const { user } = await requireApiUser();
    const attemptId = uuidParam.parse((await ctx.params).attemptId);
    return submitAssessment(user.id, attemptId, await readJson(request, submitAssessmentSchema));
  });
}
