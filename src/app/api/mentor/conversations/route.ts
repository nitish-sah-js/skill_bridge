import { handle, readJson } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { createConversation, listConversations } from "@/features/mentor/service";
import { createConversationSchema } from "@/lib/validation/schemas";

export async function GET() {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    return listConversations(supabase, user.id);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    return createConversation(supabase, user.id, await readJson(request, createConversationSchema));
  }, 201);
}
