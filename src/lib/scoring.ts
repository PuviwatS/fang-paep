import { CATEGORIES, MAX_TRIES, RESULT_EMOJI, SNIPPET_SECONDS } from "./constants";
import type { Category, Guess, GuessResult, Song } from "./types";

export function evaluateGuess(guess: Song, answer: Song): GuessResult {
  if (guess.id === answer.id) return "correct";
  if (guess.artist === answer.artist) return "artist";
  return "wrong";
}

export function isWon(guesses: readonly Guess[]): boolean {
  return guesses.some((guess) => guess.result === "correct");
}

export function isFinished(guesses: readonly Guess[]): boolean {
  return isWon(guesses) || guesses.length >= MAX_TRIES;
}

/** Seconds of audio the player may hear right now. */
export function unlockedSeconds(guesses: readonly Guess[]): number {
  if (isFinished(guesses)) return SNIPPET_SECONDS[SNIPPET_SECONDS.length - 1];
  return SNIPPET_SECONDS[guesses.length];
}

/** Text players paste into chats, e.g. "ฟังแป๊บ #15 (ทั้งหมด) 4 วิ" plus a row of squares. */
export function buildShareText(day: number, category: Category, guesses: readonly Guess[]): string {
  const categoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? "";
  const squares =
    guesses.map((guess) => RESULT_EMOJI[guess.result]).join("") +
    "⬜".repeat(Math.max(0, MAX_TRIES - guesses.length));
  const score = isWon(guesses) ? `${SNIPPET_SECONDS[guesses.length - 1]} วิ` : "ไม่รอด";
  return `ฟังแป๊บ #${day} (${categoryLabel}) ${score}\n${squares}`;
}
