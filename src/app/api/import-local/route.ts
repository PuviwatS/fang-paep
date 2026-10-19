import type { Json } from "@/lib/supabase/database.types";
import { fromDatabaseError } from "@/lib/api/errors";
import { handle, parseBody } from "@/lib/api/route-helpers";
import { importBodySchema } from "@/lib/api/schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/import-local  { games: [{ day, category, guesses: [{ songId }] }] }
 * After login, copies finished daily games played in this browser into the account.
 * The database re-checks every guess; imported games count for stats but not the leaderboard.
 */
export const POST = handle(async (request: Request) => {
  const { games } = await parseBody(importBodySchema, request);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("import_local_games", { p_games: games as unknown as Json });
  if (error) throw fromDatabaseError(error);
  return data as { imported: number };
});
