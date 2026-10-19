import { fromDatabaseError } from "@/lib/api/errors";
import { handle } from "@/lib/api/route-helpers";
import type { Account } from "@/lib/api/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST /api/subscription/resume — undo a cancellation before the period ends. */
export const POST = handle(async () => {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("resume_subscription");
  if (error) throw fromDatabaseError(error);
  return data as unknown as Account;
});
