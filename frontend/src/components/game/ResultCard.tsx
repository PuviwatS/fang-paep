"use client";

import Link from "next/link";
import { useState } from "react";
import type { Answer } from "@/lib/api/types";
import { SNIPPET_SECONDS } from "@/lib/constants";
import { msUntilNextDay } from "@/lib/daily";
import { formatDuration, formatPercent } from "@/lib/format";
import { buildShareText } from "@/lib/scoring";
import type { Category, GameMode, Guess, PlayerStats } from "@/lib/types";
import styles from "./ResultCard.module.css";

interface ResultCardProps {
  answer: Answer | null;
  guesses: readonly Guess[];
  won: boolean;
  mode: GameMode;
  /** Daily game number; null in practice. */
  day: number | null;
  isToday: boolean;
  category: Category;
  stats: PlayerStats | null;
  loggedIn: boolean;
  onNextSong: () => void;
}

/** Shown when the round ends: reveals the song, offers sharing and a link to the full track. */
export function ResultCard({
  answer,
  guesses,
  won,
  mode,
  day,
  isToday,
  category,
  stats,
  loggedIn,
  onNextSong,
}: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = buildShareText(day ?? 0, category, guesses);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard blocked: let the player copy it by hand.
      window.prompt("คัดลอกผลลัพธ์", text);
    }
  }

  const heading = won ? `ทายถูกใน ${SNIPPET_SECONDS[guesses.length - 1]} วินาที` : "เพลงนี้คือ";

  return (
    <section
      className={won ? `${styles.card} ${styles.won}` : styles.card}
      aria-live="polite"
      data-testid="result"
    >
      {answer?.artworkUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote iTunes artwork, no need for next/image here
        <img className={styles.artwork} src={answer.artworkUrl} alt="" width={96} height={96} />
      )}

      <div className={styles.body}>
        <p className={styles.heading} data-testid="result-heading">
          {heading}
        </p>
        <h2 className={styles.title} data-testid="result-title">
          {answer?.title ?? "…"}
        </h2>
        {answer && (
          <p className={styles.meta}>
            {answer.artist}
            {answer.year ? ` · ${answer.year}` : ""}
          </p>
        )}

        <div className={styles.actions}>
          {mode === "daily" && (
            <button className={styles.primary} onClick={share}>
              {copied ? "คัดลอกผลแล้ว" : "แชร์ผล"}
            </button>
          )}
          {mode === "practice" && (
            <button className={styles.primary} onClick={onNextSong}>
              เพลงถัดไป
            </button>
          )}
          {mode === "daily" && isToday && (
            <Link href={`/leaderboard?category=${category}`}>ดูอันดับวันนี้</Link>
          )}
          {answer?.trackUrl && (
            <a href={answer.trackUrl} target="_blank" rel="noreferrer">
              ฟังเต็มเพลงบน Apple Music
            </a>
          )}
        </div>

        {mode === "daily" && isToday && (
          <p className={styles.footnote}>
            {stats &&
              `เล่น ${stats.played} · ชนะ ${formatPercent(stats.wins, stats.played)} · สตรีค ${stats.streak} วัน · `}
            เพลงใหม่ในอีก {formatDuration(msUntilNextDay())}
          </p>
        )}
        {mode === "daily" && isToday && !loggedIn && (
          <p className={styles.footnote}>
            <Link href="/login">เข้าสู่ระบบ</Link> เพื่อเก็บสถิติข้ามเครื่องและขึ้นอันดับ
          </p>
        )}
      </div>
    </section>
  );
}
