import type { NextRequest } from "next/server";
import { handle, uuidParam } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { deleteConversation, getConversation } from "@/features/mentor/service";

type Ctx = RouteContext<"/api/mentor/conversations/[conversationId]">;

export async function GET(_request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    return getConversation(supabase, user.id, uuidParam.parse((await ctx.params).conversationId));
  });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    await deleteConversation(supabase, user.id, uuidParam.parse((await ctx.params).conversationId));
    return { deleted: true };
  });
}
