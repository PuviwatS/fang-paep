import { ARTIST_ALIASES, SONGS, shortTitle } from "./songs";
import type { Song } from "./types";

/** Lowercase and drop spaces and punctuation, keeping Thai letters, Latin letters and digits. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9฀-๿]/g, "");
}

interface SearchEntry {
  song: Song;
  titleKeys: string[];
  artistKeys: string[];
}

const SEARCH_INDEX: SearchEntry[] = SONGS.map((song) => ({
  song,
  titleKeys: [song.title, shortTitle(song.title)].map(normalize),
  artistKeys: [song.artist, ...(ARTIST_ALIASES[song.artist] ?? [])].map(normalize),
}));

/** Higher is better. A title match beats an artist match; a prefix match beats a match anywhere. */
const SCORE = {
  titlePrefix: 4,
  artistPrefix: 3,
  titleContains: 2,
  artistContains: 1,
  none: 0,
} as const;

function scoreEntry(entry: SearchEntry, query: string): number {
  if (entry.titleKeys.some((key) => key.startsWith(query))) return SCORE.titlePrefix;
  if (entry.artistKeys.some((key) => key.startsWith(query))) return SCORE.artistPrefix;
  if (entry.titleKeys.some((key) => key.includes(query))) return SCORE.titleContains;
  if (entry.artistKeys.some((key) => key.includes(query))) return SCORE.artistContains;
  return SCORE.none;
}

/**
 * Find songs by Thai or English title, artist name or Thai artist alias.
 * Songs in `excludeIds` (already guessed) are left out.
 */
export function searchSongs(query: string, excludeIds: ReadonlySet<number>, limit = 8): Song[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  return SEARCH_INDEX.filter((entry) => !excludeIds.has(entry.song.id))
    .map((entry) => ({ song: entry.song, score: scoreEntry(entry, normalizedQuery) }))
    .filter((match) => match.score > SCORE.none)
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title, "th"))
    .slice(0, limit)
    .map((match) => match.song);
}
