import Link from "next/link";
import styles from "./GameToolbar.module.css";

interface GameToolbarProps {
  /** Daily game number, or null in practice mode / while loading. */
  day: number | null;
  /** True when playing a past day from the archive. */
  isArchive: boolean;
  onOpenHelp: () => void;
}

/** The row above the game: which game this is, and the rules button. */
export function GameToolbar({ day, isArchive, onOpenHelp }: GameToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        {day !== null && (
          <span className={styles.dayChip} data-testid="day">
            เกม #{day}
          </span>
        )}
        {isArchive && (
          <span className={styles.archive}>
            เล่นย้อนหลัง · <Link href="/">กลับไปวันนี้</Link>
          </span>
        )}
      </div>
      <button className={styles.helpButton} onClick={onOpenHelp} aria-label="วิธีเล่น">
        ?
      </button>
    </div>
  );
}
