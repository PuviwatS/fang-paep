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

export function loadDailyGame(day: number, category: Category): SavedGuess[] {
  return read<SavedGuess[]>(KEYS.dailyGame(day, category)) ?? [];
}

export function saveDailyGame(day: number, category: Category, guesses: SavedGuess[]): void {
  write(KEYS.dailyGame(day, category), guesses);
}

// ---- Stats ------------------------------------------------------------------

const EMPTY_STATS: PlayerStats = { played: 0, wins: 0, streak: 0, bestStreak: 0, lastDay: 0 };

export function loadStats(category: Category): PlayerStats {
  return { ...EMPTY_STATS, ...read<PlayerStats>(KEYS.stats(category)) };
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
