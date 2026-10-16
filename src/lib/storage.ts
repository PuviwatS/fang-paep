import type { Category, GuessResult, PlayerStats } from "./types";

/**
 * Thin wrapper around localStorage. Reads and writes never throw: in a private window or with
 * storage blocked, the game still works and simply doesn't remember progress.
 */
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: ignore.
  }
}

const KEYS = {
  helpSeen: "fp:seen-help",
  dailyGame: (day: number, category: Category) => `fp:day:${day}:${category}`,
  stats: (category: Category) => `fp:stats:${category}`,
};

// ---- First-visit help -------------------------------------------------------

export function hasSeenHelp(): boolean {
  return read<boolean>(KEYS.helpSeen) === true;
}

export function markHelpSeen(): void {
  write(KEYS.helpSeen, true);
}

// ---- Daily game progress ----------------------------------------------------

/** What we persist for each attempt: the result and the guessed song's id. */
export interface SavedGuess {
  result: GuessResult;
  songId?: number;
}

const GUESS_RESULTS: readonly GuessResult[] = ["correct", "artist", "wrong", "skip"];

/** Accepts one saved attempt in the current format or the first demo's format ({ result, id }). */
function parseSavedGuess(value: unknown): SavedGuess | null {
  if (typeof value !== "object" || value === null) return null;
  const { result, songId, id } = value as { result?: unknown; songId?: unknown; id?: unknown };
  if (!GUESS_RESULTS.includes(result as GuessResult)) return null;
  const savedId = typeof songId === "number" ? songId : typeof id === "number" ? id : undefined;
  return { result: result as GuessResult, songId: savedId };
}

/**
 * Saved attempts for a day. Data written by older versions, or edited by hand, must never crash
 * the page, so anything that doesn't look like a list of attempts counts as "no progress yet".
 */
export function loadDailyGame(day: number, category: Category): SavedGuess[] {
  const stored = read<unknown>(KEYS.dailyGame(day, category));
  // The first demo saved { guesses: [...] } instead of a plain array.
  const list = Array.isArray(stored)
    ? stored
    : Array.isArray((stored as { guesses?: unknown } | null)?.guesses)
      ? (stored as { guesses: unknown[] }).guesses
      : [];
  return list.map(parseSavedGuess).filter((guess): guess is SavedGuess => guess !== null);
}

export function saveDailyGame(day: number, category: Category, guesses: SavedGuess[]): void {
  write(KEYS.dailyGame(day, category), guesses);
}

// ---- Stats ------------------------------------------------------------------

const EMPTY_STATS: PlayerStats = { played: 0, wins: 0, streak: 0, bestStreak: 0, lastDay: 0 };

const toCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

export function loadStats(category: Category): PlayerStats {
  const stored = read<Record<string, unknown>>(KEYS.stats(category));
  if (typeof stored !== "object" || stored === null) return { ...EMPTY_STATS };
  return {
    played: toCount(stored.played),
    wins: toCount(stored.wins),
    streak: toCount(stored.streak),
    // The first demo called this field "best".
    bestStreak: toCount(stored.bestStreak ?? stored.best),
    lastDay: toCount(stored.lastDay),
  };
}

/** Record a finished daily game once per day and category. Returns the updated stats. */
export function recordDailyResult(category: Category, day: number, won: boolean): PlayerStats {
  const stats = loadStats(category);
  if (stats.lastDay === day) return stats;

  const next: PlayerStats = {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    streak: won ? (stats.lastDay === day - 1 ? stats.streak + 1 : 1) : 0,
    bestStreak: stats.bestStreak,
    lastDay: day,
  };
  next.bestStreak = Math.max(next.bestStreak, next.streak);

  write(KEYS.stats(category), next);
  return next;
}
