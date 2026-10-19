import { fromDatabaseError } from "@/lib/api/errors";
import { handle, parseQuery } from "@/lib/api/route-helpers";
import { leaderboardQuerySchema } from "@/lib/api/schemas";
import type { LeaderboardResponse } from "@/lib/api/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/leaderboard?category=all&day=12 — top 50 players who solved that day live. */
export const GET = handle(async (request: Request) => {
  const { category, day } = parseQuery(leaderboardQuerySchema, request);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_category: category, p_day: day });
  if (error) throw fromDatabaseError(error);
  return data as unknown as LeaderboardResponse;
});
