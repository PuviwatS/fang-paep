"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";
import { CATEGORIES } from "@/lib/constants";
import { getDayNumber } from "@/lib/daily";
import { formatGameDay } from "@/lib/format";
import type { Category } from "@/lib/types";
import styles from "./archive.module.css";

export default function ArchivePage() {
  const { ready, user, account, isPlus } = useAuth();
  const [category, setCategory] = useState<Category>("all");
  const today = getDayNumber();
  // Newest first; today's game is played on the home page.
  const days = Array.from({ length: Math.max(0, today - 1) }, (_, index) => today - 1 - index);
  const checking = !ready || (user && !account);

  return (
    <div className={ui.page}>
      <h1 className={ui.title}>เกมย้อนหลัง</h1>
      <p className={ui.lead}>เล่นเพลงประจำวันที่พลาดไป ไม่นับสถิติและอันดับ</p>

      {checking ? (
        <p className={ui.muted}>กำลังโหลด…</p>
      ) : !isPlus ? (
        <section className={ui.card} data-testid="archive-locked">
          <h2 className={ui.cardTitle}>
            สำหรับสมาชิกพลัส <span className={ui.badge}>พลัส</span>
          </h2>
          <p className={ui.muted}>ตอนนี้มีเกมย้อนหลังให้เล่น {days.length} วันในทุกหมวด</p>
          <div className={ui.row}>
            <Link href="/pricing" className={ui.button}>
              สมัครพลัส
            </Link>
            {!user && (
              <Link href="/login?next=/archive" className={ui.ghostButton}>
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className={ui.tabs}>
            {CATEGORIES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={item.key === category ? `${ui.tab} ${ui.tabActive}` : ui.tab}
                onClick={() => setCategory(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {days.length === 0 ? (
            <p className={ui.muted}>ยังไม่มีเกมย้อนหลัง</p>
          ) : (
            <ul className={styles.grid} data-testid="archive-grid">
              {days.map((day) => (
                <li key={day}>
                  <Link href={`/?category=${category}&day=${day}`} className={styles.day}>
                    <span className={styles.number}>#{day}</span>
                    <span className={styles.date}>{formatGameDay(day)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
