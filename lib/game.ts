import rawSongs from "@/data/songs.json";
import artistAliases from "@/data/artists.json";

export type Category = "all" | "rock" | "pop" | "luk" | "hiphop";

export interface Song {
  id: number;
  title: string;
  artist: string;
  cat: Exclude<Category, "all">;
  year: string;
}

export type GuessResult = "correct" | "artist" | "wrong" | "skip";

export interface Guess {
  result: GuessResult;
  song?: Song;
}

/** Length (seconds) of the clip unlocked at each attempt. */
export const SNIPPETS = [0.5, 1, 2, 4, 8, 16];
export const MAX_TRIES = SNIPPETS.length;

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "pop", label: "ป๊อป/อินดี้" },
  { key: "rock", label: "ร็อก" },
  { key: "luk", label: "ลูกทุ่ง" },
  { key: "hiphop", label: "ฮิปฮอป" },
];

export const SONGS: Song[] = (rawSongs as [number, string, string, string, string][]).map(
  ([id, title, artist, cat, year]) => ({ id, title, artist, cat: cat as Song["cat"], year }),
);

const ALIASES = artistAliases as Record<string, string[]>;

/** Lowercase, drop spaces and punctuation, keep Thai and Latin letters and digits. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9฀-๿]/g, "");
}

/** Title without "(feat. ...)" or English subtitle in brackets. */
export function baseTitle(title: string): string {
  return title.replace(/\s*[\(\[].*$/, "").trim() || title;
}

interface Indexed {
  song: Song;
  keys: string[];
}

const INDEX: Indexed[] = SONGS.map((song) => ({
  song,
  keys: [song.title, baseTitle(song.title), song.artist, ...(ALIASES[song.artist] ?? [])].map(normalize),
}));

/** Search songs by Thai or English title, artist name or Thai artist alias. */
export function searchSongs(query: string, exclude: Set<number>, limit = 8): Song[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { song: Song; score: number }[] = [];
  for (const { song, keys } of INDEX) {
    if (exclude.has(song.id)) continue;
    let score = -1;
    keys.forEach((k, i) => {
      if (k.startsWith(q)) score = Math.max(score, i < 2 ? 3 : 2);
      else if (k.includes(q)) score = Math.max(score, i < 2 ? 1 : 0.5);
    });
    if (score >= 0) scored.push({ song, score });
  }
  scored.sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title, "th"));
  return scored.slice(0, limit).map((s) => s.song);
}

export function evaluate(guess: Song, answer: Song): GuessResult {
  if (guess.id === answer.id) return "correct";
  if (guess.artist === answer.artist) return "artist";
  return "wrong";
}

/** Game #1 is 1 Oct 2026, counted in Bangkok time so the song changes at local midnight. */
const EPOCH_UTC = Date.UTC(2026, 9, 1);
export function dayNumber(now = new Date()): number {
  const bangkok = now.getTime() + 7 * 3600 * 1000;
  return Math.floor((bangkok - EPOCH_UTC) / 86_400_000) + 1;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function poolFor(cat: Category): Song[] {
  return cat === "all" ? SONGS : SONGS.filter((s) => s.cat === cat);
}

/** Same song for everyone on a given day; no repeats until the whole pool has been used. */
export function dailySong(cat: Category, day: number): Song {
  const pool = [...poolFor(cat)].sort((a, b) => a.id - b.id);
  const cycle = Math.floor((day - 1) / pool.length);
  const rand = mulberry32(hash(`${cat}:${cycle}`));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool[(((day - 1) % pool.length) + pool.length) % pool.length];
}

export function randomSong(cat: Category, avoid?: number): Song {
  const pool = poolFor(cat).filter((s) => s.id !== avoid);
  return pool[Math.floor(Math.random() * pool.length)];
}

const SQUARE: Record<GuessResult, string> = { correct: "🟩", artist: "🟨", wrong: "🟥", skip: "⬛" };

export function shareText(day: number, cat: Category, guesses: Guess[], won: boolean): string {
  const label = CATEGORIES.find((c) => c.key === cat)?.label ?? "";
  const row = guesses.map((g) => SQUARE[g.result]).join("") + "⬜".repeat(MAX_TRIES - guesses.length);
  const score = won ? `${SNIPPETS[guesses.length - 1]} วิ` : "ไม่รอด";
  return `ฟังแป๊บ #${day} (${label}) ${score}\n${row}`;
}

/** Preview data comes from the iTunes Lookup API at play time; audio is never stored by us. */
export interface Preview {
  previewUrl: string;
  artwork: string;
  trackUrl: string;
}

export async function lookupPreview(id: number): Promise<Preview> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&country=th`);
  if (!res.ok) throw new Error(`iTunes lookup failed: ${res.status}`);
  const data = await res.json();
  const r = data.results?.[0];
  if (!r?.previewUrl) throw new Error("No preview for this track");
  return {
    previewUrl: r.previewUrl,
    artwork: String(r.artworkUrl100 ?? "").replace("100x100bb", "300x300bb"),
    trackUrl: r.trackViewUrl ?? "",
  };
}
