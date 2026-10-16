import styles from "./GameHeader.module.css";

interface GameHeaderProps {
  day: number;
  onOpenHelp: () => void;
}

export function GameHeader({ day, onOpenHelp }: GameHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.name}>ฟังแป๊บ</span>
        <span className={styles.tagline}>ทายเพลงไทยจากเสียงไม่กี่วินาที</span>
      </div>
      <div className={styles.actions}>
        <span className={styles.dayChip} aria-label={`เกมที่ ${day}`}>
          #{day}
        </span>
        <button className={styles.helpButton} onClick={onOpenHelp} aria-label="วิธีเล่น">
          ?
        </button>
      </div>
    </header>
  );
}
