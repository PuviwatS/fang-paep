import { fromDatabaseError } from "@/lib/api/errors";
import { handle, parseQuery } from "@/lib/api/route-helpers";
import { categoryQuerySchema } from "@/lib/api/schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PlayerStats } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/stats?category=all — the logged-in player's stats for one category. */
export const GET = handle(async (request: Request) => {
  const { category } = parseQuery(categoryQuerySchema, request);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_stats", { p_category: category });
  if (error) throw fromDatabaseError(error);
  return data as unknown as PlayerStats;
});
