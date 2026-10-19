import { NextResponse } from "next/server";
import type { Plan } from "@/lib/api/types";
import { getSupabasePublicClient } from "@/lib/supabase/server";

// Built on request, then cached by the CDN for an hour via Cache-Control.
export const dynamic = "force-dynamic";

/** GET /api/plans — the Plus plans on sale. */
export async function GET() {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, price_thb, billing_interval, features")
    .order("sort_order");

  if (error || !data) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "server_error", message: "โหลดแพ็กเกจไม่สำเร็จ" } },
      { status: 500 },
    );
  }

  const plans: Plan[] = data.map((row) => ({
    id: row.id,
    name: row.name,
    priceThb: row.price_thb,
    billingInterval: row.billing_interval as Plan["billingInterval"],
    features: row.features,
  }));
  return NextResponse.json(plans, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
