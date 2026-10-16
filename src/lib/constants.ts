import type { Category, GuessResult } from "./types";

/** Clip length in seconds unlocked at each attempt. The array length is the number of tries. */
export const SNIPPET_SECONDS = [0.5, 1, 2, 4, 8, 16] as const;

export const MAX_TRIES = SNIPPET_SECONDS.length;

/** Longest clip, unlocked once the game is over. */
export const FULL_SNIPPET_SECONDS = SNIPPET_SECONDS[SNIPPET_SECONDS.length - 1];

export const CATEGORIES: ReadonlyArray<{ key: Category; label: string }> = [
  { key: "all", label: "ทั้งหมด" },
  { key: "pop", label: "ป๊อป/อินดี้" },
  { key: "rock", label: "ร็อก" },
  { key: "luk", label: "ลูกทุ่ง" },
  { key: "hiphop", label: "ฮิปฮอป" },
];

export const RESULT_LABELS: Record<Exclude<GuessResult, "skip">, string> = {
  correct: "ถูก",
  artist: "ศิลปินถูก",
  wrong: "ผิด",
};

export const RESULT_EMOJI: Record<GuessResult, string> = {
  correct: "🟩",
  artist: "🟨",
  wrong: "🟥",
  skip: "⬛",
};

/** Daily game #1 is 1 October 2026. */
export const FIRST_GAME_DATE_UTC = Date.UTC(2026, 9, 1);

/** Thailand is UTC+7 all year (no daylight saving), so the daily song changes at Thai midnight. */
export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup";
export const ITUNES_COUNTRY = "th";
