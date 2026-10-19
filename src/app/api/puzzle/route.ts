import { fromDatabaseError } from "@/lib/api/errors";
import { handle, parseQuery } from "@/lib/api/route-helpers";
import { puzzleQuerySchema } from "@/lib/api/schemas";
import type { PuzzleResponse } from "@/lib/api/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/puzzle?category=all&day=12
 * Today's puzzle (or a past day for Plus members): the audio URL and, for logged-in players,
 * their progress. The answer is only included once the round is over.
 */
export const GET = handle(async (request: Request) => {
  const { category, day } = parseQuery(puzzleQuerySchema, request);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_puzzle", { p_category: category, p_day: day });
  if (error) throw fromDatabaseError(error);
  return data as unknown as PuzzleResponse;
});
