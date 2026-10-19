import { fromDatabaseError } from "@/lib/api/errors";
import { handle, parseBody } from "@/lib/api/route-helpers";
import { guessBodySchema } from "@/lib/api/schemas";
import type { GuessResponse } from "@/lib/api/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/guess  { category, day, songId | null, attempt }
 * Checks one attempt on the server. songId null = skip.
 */
export const POST = handle(async (request: Request) => {
  const body = await parseBody(guessBodySchema, request);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_guess", {
    p_category: body.category,
    p_day: body.day,
    p_song_id: body.songId ?? undefined,
    p_attempt: body.attempt,
  });
  if (error) throw fromDatabaseError(error);
  return data as unknown as GuessResponse;
});
