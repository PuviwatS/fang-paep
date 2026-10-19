import { fromDatabaseError } from "@/lib/api/errors";
import { handle, parseBody } from "@/lib/api/route-helpers";
import { checkoutBodySchema } from "@/lib/api/schemas";
import type { Account } from "@/lib/api/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/checkout  { planId }
 * MOCK: activates Plus without charging anything. Only works while the database setting
 * payments_mode = 'mock'. Replace with a real provider's checkout + webhook before launch.
 */
export const POST = handle(async (request: Request) => {
  const { planId } = await parseBody(checkoutBodySchema, request);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("mock_checkout", { p_plan_id: planId });
  if (error) throw fromDatabaseError(error);
  return data as unknown as Account;
});
