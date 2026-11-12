"use client";

import styles from "./error.module.css";

/**
 * Shown instead of a blank "Application error" page if something in the game throws.
 * "เริ่มใหม่" clears this site's saved progress, which fixes problems caused by bad saved data.
 */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  function clearSavedDataAndRetry() {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("fp:"))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage unavailable: just retry.
    }
    reset();
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>เกมสะดุดนิดหน่อย</h1>
      <p className={styles.text}>ลองเริ่มใหม่ได้เลย ความคืบหน้าของวันนี้ในเครื่องนี้จะถูกล้าง</p>
      <button className={styles.button} onClick={clearSavedDataAndRetry}>
        เริ่มใหม่
      </button>
    </main>
  );
}
