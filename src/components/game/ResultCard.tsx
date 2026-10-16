"use client";

import { useState } from "react";
import { SNIPPET_SECONDS } from "@/lib/constants";
import { msUntilNextDay } from "@/lib/daily";
import { formatDuration, formatPercent } from "@/lib/format";
import { buildShareText } from "@/lib/scoring";
import type { Category, GameMode, Guess, PlayerStats, Preview, Song } from "@/lib/types";
import styles from "./ResultCard.module.css";

interface ResultCardProps {
  answer: Song;
  preview: Preview | null;
  guesses: readonly Guess[];
  won: boolean;
  mode: GameMode;
  day: number;
  category: Category;
  stats: PlayerStats | null;
  onNextSong: () => void;
}

/** Shown when the round ends: reveals the song, offers sharing and a link to the full track. */
export function ResultCard({
  answer,
  preview,
  guesses,
  won,
  mode,
  day,
  category,
  stats,
  onNextSong,
}: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = buildShareText(day, category, guesses);
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
      {preview?.artworkUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote iTunes artwork, no need for next/image here
        <img className={styles.artwork} src={preview.artworkUrl} alt="" width={96} height={96} />
      )}

      <div className={styles.body}>
        <p className={styles.heading} data-testid="result-heading">
          {heading}
        </p>
        <h2 className={styles.title} data-testid="result-title">
          {answer.title}
        </h2>
        <p className={styles.meta}>
          {answer.artist} · {answer.year}
        </p>

        <div className={styles.actions}>
          <button className={styles.primary} onClick={share}>
            {copied ? "คัดลอกผลแล้ว" : "แชร์ผล"}
          </button>
          {mode === "practice" && <button onClick={onNextSong}>เพลงถัดไป</button>}
          {preview?.trackUrl && (
            <a href={preview.trackUrl} target="_blank" rel="noreferrer">
              ฟังเต็มเพลงบน Apple Music
            </a>
          )}
        </div>

        {mode === "daily" && (
          <p className={styles.footnote}>
            {stats &&
              `เล่น ${stats.played} · ชนะ ${formatPercent(stats.wins, stats.played)} · สตรีค ${stats.streak} วัน · `}
            เพลงใหม่ในอีก {formatDuration(msUntilNextDay())}
          </p>
        )}
      </div>
    </section>
  );
}
