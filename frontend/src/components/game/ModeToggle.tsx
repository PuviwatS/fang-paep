import type { GameMode } from "@/lib/types";
import styles from "./ModeToggle.module.css";

const MODES: ReadonlyArray<{ key: GameMode; label: string }> = [
  { key: "daily", label: "เพลงประจำวัน" },
  { key: "practice", label: "สุ่มเล่นไม่จำกัด" },
];

interface ModeToggleProps {
  value: GameMode;
  onChange: (mode: GameMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className={styles.toggle} role="group" aria-label="โหมดเกม">
      {MODES.map((mode) => (
        <button
          key={mode.key}
          className={mode.key === value ? `${styles.option} ${styles.active}` : styles.option}
          onClick={() => onChange(mode.key)}
          aria-pressed={mode.key === value}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
