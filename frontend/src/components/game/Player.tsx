import { FULL_SNIPPET_SECONDS, SNIPPET_SECONDS } from "@/lib/constants";
import styles from "./Player.module.css";

interface PlayerProps {
  /** Seconds the player is allowed to hear. */
  unlockedSeconds: number;
  /** Current playback position in seconds. */
  position: number;
  isPlaying: boolean;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  onToggle: () => void;
}

const percentOfFull = (seconds: number) => `${(seconds / FULL_SNIPPET_SECONDS) * 100}%`;

/** Tape-style progress bar with markers at each unlock point, plus the play button. */
export function Player({
  unlockedSeconds,
  position,
  isPlaying,
  isReady,
  isLoading,
  error,
  onToggle,
}: PlayerProps) {
  return (
    <section className={styles.player} aria-label="เครื่องเล่น">
      <div className={styles.tape} role="presentation">
        <div className={styles.unlocked} style={{ width: percentOfFull(unlockedSeconds) }} />
        <div
          className={styles.played}
          style={{ width: percentOfFull(Math.min(position, unlockedSeconds)) }}
        />
        {SNIPPET_SECONDS.slice(0, -1).map((seconds) => (
          <span key={seconds} className={styles.marker} style={{ left: percentOfFull(seconds) }} />
        ))}
      </div>

      <div className={styles.controls}>
        <span className={styles.counter} data-testid="position">
          {position.toFixed(1)}
        </span>
        <button
          className={styles.playButton}
          onClick={onToggle}
          disabled={!isReady}
          aria-label={isPlaying ? "หยุด" : "เล่นท่อนเพลง"}
          data-testid="play"
        >
          <span className={isPlaying ? styles.stopIcon : styles.playIcon} />
        </button>
        <span className={`${styles.counter} ${styles.limit}`}>{unlockedSeconds} วิ</span>
      </div>

      {isLoading && <p className={styles.note}>กำลังโหลดเสียง…</p>}
      {error && <p className={`${styles.note} ${styles.error}`}>{error}</p>}
    </section>
  );
}
