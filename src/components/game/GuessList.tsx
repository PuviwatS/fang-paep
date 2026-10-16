import { MAX_TRIES, RESULT_LABELS, SNIPPET_SECONDS } from "@/lib/constants";
import { shortTitle } from "@/lib/songs";
import type { Guess, GuessResult } from "@/lib/types";
import styles from "./GuessList.module.css";

const RESULT_CLASS: Record<GuessResult, string> = {
  correct: styles.correct,
  artist: styles.artistMatch,
  wrong: styles.wrong,
  skip: styles.skipped,
};

interface GuessListProps {
  guesses: readonly Guess[];
  finished: boolean;
}

/** One row per attempt: clip length, the guessed song, and whether it was right. */
export function GuessList({ guesses, finished }: GuessListProps) {
  return (
    <ol className={styles.list} aria-label="คำตอบที่ทายไปแล้ว">
      {Array.from({ length: MAX_TRIES }, (_, index) => {
        const guess = guesses[index];
        const isNext = index === guesses.length && !finished;
        const className = [styles.row, guess && RESULT_CLASS[guess.result], isNext && styles.next]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={index} className={className} data-testid="guess-row" data-result={guess?.result ?? ""}>
            <span className={styles.seconds}>{SNIPPET_SECONDS[index]} วิ</span>
            <span className={styles.text}>
              {guess?.result === "skip" && "ข้าม"}
              {guess?.song && (
                <>
                  <b className={styles.title}>{shortTitle(guess.song.title)}</b>
                  <span className={styles.artistName}>{guess.song.artist}</span>
                </>
              )}
            </span>
            {guess && guess.result !== "skip" && (
              <span className={styles.tag}>{RESULT_LABELS[guess.result]}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
