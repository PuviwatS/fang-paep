import styles from "./AdSlot.module.css";

interface AdSlotProps {
  width?: number;
  height?: number;
}

/** Placeholder showing where an ad unit (AdSense / Ad Manager) would go. Not wired to any network yet. */
export function AdSlot({ width = 320, height = 100 }: AdSlotProps) {
  return (
    <div className={styles.slot} style={{ height }}>
      <span>
        พื้นที่โฆษณา {width}×{height}
      </span>
      <small className={styles.hint}>ตัวอย่างตำแหน่ง AdSense / Ad Manager</small>
    </div>
  );
}
