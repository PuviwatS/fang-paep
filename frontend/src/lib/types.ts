/** A song category tab. "all" mixes every category together. */
export type Category = "all" | "rock" | "pop" | "luk" | "hiphop";

/** A category a song can actually belong to. */
export type SongCategory = Exclude<Category, "all">;

export interface Song {
  /** iTunes trackId. Used to look up the audio preview at play time. */
  id: number;
  title: string;
  artist: string;
  category: SongCategory;
  year: string;
}

/** How one attempt went. */
export type GuessResult = "correct" | "artist" | "wrong" | "skip";

export interface Guess {
  result: GuessResult;
  /** The song the player picked. Empty for a skip. */
  song?: Song;
}

export type GameMode = "daily" | "practice";

/** Playable audio for one song, from the iTunes Lookup API. */
export interface Preview {
  previewUrl: string;
  artworkUrl: string;
  trackUrl: string;
}

export interface PlayerStats {
  played: number;
  wins: number;
  streak: number;
  bestStreak: number;
  /** Day number of the last finished daily game, used to continue or reset the streak. */
  lastDay: number;
}
