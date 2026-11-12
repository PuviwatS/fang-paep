import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { MockCheckout } from "./MockCheckout";

export const metadata: Metadata = { title: "ชำระเงิน (ทดสอบ) — ฟังแป๊บ" };

export default function CheckoutPage() {
  return (
    <Suspense>
      <RequireLogin>
        <MockCheckout />
      </RequireLogin>
    </Suspense>
  );
}
