import type { NextRequest } from "next/server";
import { handle, readJson, uuidParam } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { getTask, updateTask } from "@/features/roadmap/service";
import { taskUpdateSchema } from "@/lib/validation/schemas";

type Ctx = RouteContext<"/api/learning-tasks/[taskId]">;

export async function GET(_request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    return getTask(supabase, user.id, uuidParam.parse((await ctx.params).taskId));
  });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    const taskId = uuidParam.parse((await ctx.params).taskId);
    await updateTask(supabase, user.id, taskId, await readJson(request, taskUpdateSchema));
    return (await getTask(supabase, user.id, taskId)).task;
  });
}
