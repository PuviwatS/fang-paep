"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";
import { api, ApiRequestError } from "@/lib/api/client";
import type { Account, Plan } from "@/lib/api/types";
import { formatBaht } from "@/lib/format";

/**
 * MOCK checkout. No card form and no payment provider: pressing the button asks the server to
 * activate Plus directly, which only works while the database is in payments_mode = 'mock'.
 * Swap this page for the real provider's checkout (Stripe / Opn / 2C2P) before launch.
 */
export function MockCheckout() {
  const router = useRouter();
  const planId = useSearchParams().get("plan");
  const { setAccount } = useAuth();
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Plan[]>("/api/plans")
      .then((plans) => setPlan(plans.find((item) => item.id === planId) ?? null))
      .catch(() => setPlan(null));
  }, [planId]);

  async function pay() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      setAccount(await api.post<Account>("/api/subscription/checkout", { planId: plan.id }));
      router.replace("/account?welcome=plus");
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : "ชำระเงินไม่สำเร็จ");
      setBusy(false);
    }
  }

  if (plan === undefined) return <p className={ui.muted}>กำลังโหลด…</p>;

  if (plan === null) {
    return (
      <div className={ui.page}>
        <h1 className={ui.title}>ไม่พบแพ็กเกจ</h1>
        <Link href="/pricing" className={ui.link}>
          กลับไปเลือกแพ็กเกจ
        </Link>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <h1 className={ui.title}>ยืนยันการสมัคร</h1>

      <p className={ui.notice} data-testid="mock-notice">
        <strong>โหมดทดสอบ</strong> — ยังไม่มีการตัดเงินจริง กดปุ่มด้านล่างเพื่อเปิดสมาชิกพลัสทันที
      </p>

      <section className={ui.card}>
        <h2 className={ui.cardTitle}>{plan.name}</h2>
        <p className={ui.muted}>
          {formatBaht(plan.priceThb)} ต่อ{plan.billingInterval === "year" ? "ปี" : "เดือน"} · ต่ออายุอัตโนมัติ
          ยกเลิกได้ทุกเมื่อ
        </p>
        <ul className={ui.muted}>
          {plan.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
        <div className={ui.row}>
          <button type="button" className={ui.button} disabled={busy} onClick={pay} data-testid="mock-pay">
            {busy ? "กำลังดำเนินการ…" : `ชำระเงิน (ทดสอบ) ${formatBaht(plan.priceThb)}`}
          </button>
          <Link href="/pricing" className={ui.ghostButton}>
            ยกเลิก
          </Link>
        </div>
      </section>
    </div>
  );
}
