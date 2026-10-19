"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";
import { api, ApiRequestError } from "@/lib/api/client";
import type { Plan } from "@/lib/api/types";
import { formatBaht } from "@/lib/format";
import styles from "./pricing.module.css";

export default function PricingPage() {
  const { isPlus } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Plan[]>("/api/plans")
      .then(setPlans)
      .catch((requestError) =>
        setError(requestError instanceof ApiRequestError ? requestError.message : "โหลดแพ็กเกจไม่สำเร็จ"),
      );
  }, []);

  const monthly = plans?.find((plan) => plan.billingInterval === "month");

  return (
    <div className={ui.page}>
      <h1 className={ui.title}>ฟังแป๊บ พลัส</h1>
      <p className={ui.lead}>ไม่มีโฆษณา เล่นเกมย้อนหลังได้ทุกวัน มีป้ายพลัสในอันดับ</p>

      {isPlus && (
        <p className={ui.success}>
          คุณเป็นสมาชิกพลัสอยู่แล้ว ·{" "}
          <Link href="/account" className={ui.link}>
            จัดการสมาชิก
          </Link>
        </p>
      )}
      {error && <p className={ui.error}>{error}</p>}
      {!plans && !error && <p className={ui.muted}>กำลังโหลด…</p>}

      <div className={styles.plans}>
        {plans?.map((plan) => {
          const perMonth = plan.billingInterval === "year" ? Math.round(plan.priceThb / 12) : null;
          const saving =
            perMonth && monthly ? Math.round((1 - plan.priceThb / (monthly.priceThb * 12)) * 100) : null;
          return (
            <article
              key={plan.id}
              className={plan.billingInterval === "year" ? `${ui.card} ${styles.featured}` : ui.card}
              data-testid={`plan-${plan.id}`}
            >
              <div className={styles.planHead}>
                <h2 className={ui.cardTitle}>{plan.name}</h2>
                {saving !== null && saving > 0 && <span className={ui.badge}>ประหยัด {saving}%</span>}
              </div>
              <p className={styles.price}>
                {formatBaht(plan.priceThb)}
                <span>/{plan.billingInterval === "year" ? "ปี" : "เดือน"}</span>
              </p>
              {perMonth && <p className={ui.muted}>ตกเดือนละ {formatBaht(perMonth)}</p>}
              <ul className={styles.features}>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {!isPlus && (
                <Link href={`/checkout?plan=${plan.id}`} className={ui.button}>
                  เลือกแพ็กเกจนี้
                </Link>
              )}
            </article>
          );
        })}
      </div>

      <p className={ui.muted}>
        ยกเลิกได้ทุกเมื่อ ใช้ต่อได้จนจบรอบที่จ่ายไว้ · ตอนนี้ยังเป็นระบบชำระเงินทดสอบ
      </p>
    </div>
  );
}
