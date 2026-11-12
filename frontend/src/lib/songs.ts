import rawSongs from "@/data/songs.json";
import rawAliases from "@/data/artists.json";
import type { Category, Song, SongCategory } from "./types";

/** Row format of data/songs.json: [trackId, title, artist, category, year]. */
type SongRow = [number, string, string, string, string];

export const SONGS: readonly Song[] = (rawSongs as SongRow[]).map(([id, title, artist, category, year]) => ({
  id,
  title,
  artist,
  category: category as SongCategory,
  year,
}));

/** Thai (and other) spellings for each artist, keyed by the artist name used in songs.json. */
export const ARTIST_ALIASES: Readonly<Record<string, string[]>> = rawAliases;

const SONGS_BY_ID = new Map(SONGS.map((song) => [song.id, song]));

export function getSongById(id: number): Song | undefined {
  return SONGS_BY_ID.get(id);
}

/** Songs that can be picked as the answer for a category tab. */
export function songsInCategory(category: Category): Song[] {
  return category === "all" ? [...SONGS] : SONGS.filter((song) => song.category === category);
}

/** Title without a trailing "(feat. ...)" or bracketed English subtitle. */
export function shortTitle(title: string): string {
  return title.replace(/\s*[([].*$/, "").trim() || title;
}
