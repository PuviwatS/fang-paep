import styles from "./PlusCard.module.css";

/** Mock-up of the paid tier. No payment flow behind it yet. */
export function PlusCard() {
  return (
    <div className={styles.card}>
      <div>
        <b className={styles.name}>ฟังแป๊บ พลัส</b>
        <p className={styles.perks}>ไม่มีโฆษณา · เล่นย้อนหลังทุกวัน · โหมดศิลปินเดียว</p>
      </div>
      <span className={styles.badge}>ตัวอย่าง</span>
    </div>
  );
}
