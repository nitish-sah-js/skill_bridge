import { handle, readJson } from "@/lib/api/response";
import { requireApiUser } from "@/features/auth/session";
import { getProfile, updateProfile } from "@/features/profiles/service";
import { profilePatchSchema } from "@/lib/validation/schemas";

export async function GET() {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    return getProfile(supabase, user.id);
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const { user, supabase } = await requireApiUser();
    const patch = await readJson(request, profilePatchSchema);
    return updateProfile(supabase, user.id, patch);
  });
}
