import { fromDatabaseError } from "@/lib/api/errors";
import { handle, parseBody } from "@/lib/api/route-helpers";
import { displayNameSchema } from "@/lib/api/schemas";
import type { Account } from "@/lib/api/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/account — profile, subscription and Plus status of the logged-in player. */
export const GET = handle(async () => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_account");
  if (error) throw fromDatabaseError(error);
  return data as unknown as Account;
});

/** PATCH /api/account  { displayName } — rename. */
export const PATCH = handle(async (request: Request) => {
  const { displayName } = await parseBody(displayNameSchema, request);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_display_name", { p_name: displayName });
  if (error) throw fromDatabaseError(error);
  return data as unknown as Account;
});
