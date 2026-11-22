import type { NextRequest } from "next/server";
import { handle } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { getCareer } from "@/features/careers/service";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/careers/[careerId]">) {
  return handle(async () => {
    const { careerId } = await ctx.params;
    return getCareer(await createClient(), careerId);
  });
}
