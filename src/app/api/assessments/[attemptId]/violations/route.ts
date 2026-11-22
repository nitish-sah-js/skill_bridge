import type { NextRequest } from "next/server";
import { handle, readJson, uuidParam } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { recordViolation } from "@/features/assessments/service";
import { violationSchema } from "@/lib/validation/schemas";

/** Record a proctoring rule break; past the warning limit the attempt is submitted automatically. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/assessments/[attemptId]/violations">) {
  return handle(async () => {
    const { user } = await requireApiUser();
    const attemptId = uuidParam.parse((await ctx.params).attemptId);
    return recordViolation(user.id, attemptId, await readJson(request, violationSchema));
  });
}
