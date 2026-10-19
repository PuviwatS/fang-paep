"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";
import { api, ApiRequestError } from "@/lib/api/client";
import type { LeaderboardResponse } from "@/lib/api/types";
import { CATEGORIES } from "@/lib/constants";
import { getDayNumber } from "@/lib/daily";
import { formatGameDay } from "@/lib/format";
import type { Category } from "@/lib/types";
import styles from "./leaderboard.module.css";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>("all");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    api
      .get<LeaderboardResponse>(`/api/leaderboard?category=${category}`)
      .then((response) => active && setData(response))
      .catch(
        (requestError) =>
          active &&
          setError(requestError instanceof ApiRequestError ? requestError.message : "โหลดอันดับไม่สำเร็จ"),
      );
    return () => {
      active = false;
    };
  }, [category, user?.id]);

  const day = data?.day ?? getDayNumber();

  return (
    <div className={ui.page}>
      <h1 className={ui.title}>อันดับวันนี้</h1>
      <p className={ui.lead}>
        เกม #{day} · {formatGameDay(day)} · เรียงจากทายถูกเร็วที่สุด (ใช้น้อยครั้ง แล้วดูเวลาที่ตอบ)
      </p>

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

      {error && <p className={ui.error}>{error}</p>}
      {!data && !error && <p className={ui.muted}>กำลังโหลด…</p>}
      {data && data.entries.length === 0 && (
        <div className={ui.card}>
          <p className={ui.muted}>ยังไม่มีใครทายถูกในหมวดนี้วันนี้ เป็นคนแรกเลย!</p>
          <Link href={`/?category=${category}`} className={ui.button}>
            ไปเล่น
          </Link>
        </div>
      )}

      {data && data.entries.length > 0 && (
        <ol className={styles.list} data-testid="leaderboard">
          {data.entries.map((entry) => (
            <li
              key={`${entry.rank}-${entry.displayName}`}
              className={entry.isMe ? `${styles.item} ${styles.me}` : styles.item}
            >
              <span className={styles.rank}>{entry.rank}</span>
              <span className={styles.name}>
                {entry.displayName}
                {entry.isPlus && <span className={ui.badge}>พลัส</span>}
                {entry.isMe && <span className={styles.you}>คุณ</span>}
              </span>
              <span className={styles.tries}>{entry.tries}/6</span>
            </li>
          ))}
        </ol>
      )}

      {!user && (
        <p className={ui.muted}>
          <Link href="/login?next=/leaderboard" className={ui.link}>
            เข้าสู่ระบบ
          </Link>{" "}
          เพื่อให้ชื่อของคุณขึ้นอันดับ
        </p>
      )}
    </div>
  );
}
