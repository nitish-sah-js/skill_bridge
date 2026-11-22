import type { NextRequest } from "next/server";
import { fail, readJson, toAppError, uuidParam } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { startMentorReply } from "@/features/mentor/service";
import { mentorMessageSchema } from "@/lib/validation/schemas";

export const maxDuration = 60;

/**
 * Ask the mentor a question. Responds with newline-delimited JSON events
 * (start, delta..., then done or error). Failures before streaming starts use
 * the standard JSON error shape and HTTP status codes.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/mentor/conversations/[conversationId]/messages">,
) {
  try {
    const { user, supabase } = await requireApiUser();
    const conversationId = uuidParam.parse((await ctx.params).conversationId);
    const input = await readJson(request, mentorMessageSchema);
    const stream = await startMentorReply(supabase, user.id, conversationId, input);
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(toAppError(error));
  }
}
