import Link from "next/link";
import styles from "./PlusCard.module.css";

/** Promotes the Plus plan. Hidden for members. */
export function PlusCard() {
  return (
    <Link href="/pricing" className={styles.card}>
      <div>
        <b className={styles.name}>ฟังแป๊บ พลัส</b>
        <p className={styles.perks}>ไม่มีโฆษณา · เล่นย้อนหลังทุกวัน · ป้ายพลัสบนอันดับ</p>
      </div>
      <span className={styles.badge}>ดูแพ็กเกจ</span>
    </Link>
  );
}
