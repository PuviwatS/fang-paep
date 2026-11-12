import { BANGKOK_OFFSET_MS, FIRST_GAME_DATE_UTC, MS_PER_DAY } from "./constants";
import { songsInCategory } from "./songs";
import type { Category, Song } from "./types";

/** Daily game number, counted in Thai time. 1 October 2026 is game #1. */
export function getDayNumber(now: Date = new Date()): number {
  const bangkokTime = now.getTime() + BANGKOK_OFFSET_MS;
  return Math.floor((bangkokTime - FIRST_GAME_DATE_UTC) / MS_PER_DAY) + 1;
}

/** Milliseconds until the next daily song (Thai midnight). */
export function msUntilNextDay(now: Date = new Date()): number {
  const bangkokTime = now.getTime() + BANGKOK_OFFSET_MS;
  return MS_PER_DAY - (bangkokTime % MS_PER_DAY);
}

/** Small deterministic random generator (mulberry32), so every player gets the same order. */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash, used to turn a seed label into a number. */
function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The song for a category on a given day. Everyone gets the same song, and no song repeats
 * until every song in the category has been used once; then a new shuffled cycle begins.
 */
export function getDailySong(category: Category, day: number): Song {
  const pool = songsInCategory(category).sort((a, b) => a.id - b.id);
  const dayIndex = day - 1;
  const cycle = Math.floor(dayIndex / pool.length);
  const order = shuffle(pool, createSeededRandom(hashString(`${category}:${cycle}`)));
  const position = ((dayIndex % pool.length) + pool.length) % pool.length;
  return order[position];
}

/** A random song for practice mode, different from `avoidId` when possible. */
export function getRandomSong(category: Category, avoidId?: number): Song {
  const pool = songsInCategory(category);
  const candidates = pool.length > 1 ? pool.filter((song) => song.id !== avoidId) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
