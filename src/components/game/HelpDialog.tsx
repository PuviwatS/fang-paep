import { MAX_TRIES, SNIPPET_SECONDS } from "@/lib/constants";
import styles from "./HelpDialog.module.css";

interface HelpDialogProps {
  onClose: () => void;
}

export function HelpDialog({ onClose }: HelpDialogProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(event) => event.stopPropagation()}
        data-testid="help-dialog"
      >
        <h2 id="help-title" className={styles.title}>
          วิธีเล่น
        </h2>
        <p>ฟังท่อนสั้นๆ แล้วทายว่าเป็นเพลงอะไร ทายผิดหรือกดข้ามจะได้ฟังยาวขึ้น มีทั้งหมด {MAX_TRIES} ครั้ง</p>

        <ul className={styles.legend}>
          <li>
            <span className={`${styles.swatch} ${styles.correct}`} /> ถูกทั้งเพลงและศิลปิน
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.artist}`} /> ศิลปินถูก แต่ผิดเพลง
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.wrong}`} /> ผิดทั้งคู่
          </li>
        </ul>

        <p className={styles.note}>
          ความยาวที่ปลดล็อก: {SNIPPET_SECONDS.join(" → ")} วินาที เพลงประจำวันเปลี่ยนตอนเที่ยงคืนเวลาไทย
        </p>

        <button className={styles.start} onClick={onClose} data-testid="help-close">
          เริ่มเล่น
        </button>
      </div>
    </div>
  );
}
