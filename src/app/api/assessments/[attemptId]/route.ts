import type { NextRequest } from "next/server";
import { handle, readJson, uuidParam } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { abandonAttempt, getAttempt, saveDraft } from "@/features/assessments/service";
import { saveDraftSchema } from "@/lib/validation/schemas";

type Ctx = RouteContext<"/api/assessments/[attemptId]">;

/** In-progress attempts never include answer keys; submitted ones include results. */
export async function GET(_request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { user } = await requireApiUser();
    const attemptId = uuidParam.parse((await ctx.params).attemptId);
    return getAttempt(user.id, attemptId);
  });
}

/** Save draft answers so the student can resume later. */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { user } = await requireApiUser();
    const attemptId = uuidParam.parse((await ctx.params).attemptId);
    await saveDraft(user.id, attemptId, await readJson(request, saveDraftSchema));
    return { saved: true };
  });
}

/** Abandon an open attempt. */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { user } = await requireApiUser();
    const attemptId = uuidParam.parse((await ctx.params).attemptId);
    await abandonAttempt(user.id, attemptId);
    return { abandoned: true };
  });
}
