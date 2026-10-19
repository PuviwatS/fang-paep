import { fromDatabaseError } from "@/lib/api/errors";
import { handle } from "@/lib/api/route-helpers";
import type { Account } from "@/lib/api/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST /api/subscription/cancel — stop renewal; Plus stays on until the paid period ends. */
export const POST = handle(async () => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("cancel_subscription");
  if (error) throw fromDatabaseError(error);
  return data as unknown as Account;
});
