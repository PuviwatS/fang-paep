import type { Category, GuessResult, PlayerStats, SongCategory } from "@/lib/types";

/** Shapes of the JSON our /api routes return. The database functions build the same shapes. */

export interface CatalogSong {
  id: number;
  title: string;
  artist: string;
  aliases: string[];
  category: SongCategory;
  year: string;
}

export interface ServerGuess {
  result: GuessResult;
  songId: number | null;
}

export interface Answer {
  id: number;
  title: string;
  artist: string;
  year: number | null;
  artworkUrl: string | null;
  trackUrl: string | null;
}

export interface PuzzleResponse {
  day: number;
  today: number;
  category: Category;
  previewUrl: string | null;
  /** Saved attempts; only filled for logged-in players. */
  guesses: ServerGuess[];
  finished: boolean;
  won: boolean;
  answer: Answer | null;
}

export interface GuessResponse {
  result: GuessResult;
  tries: number;
  finished: boolean;
  won: boolean;
  answer: Answer | null;
  /** Updated stats once a logged-in player's daily round ends. */
  stats: PlayerStats | null;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  tries: number;
  finishedAt: string;
  isPlus: boolean;
  isMe: boolean;
}

export interface LeaderboardResponse {
  day: number;
  category: Category;
  entries: LeaderboardEntry[];
}

export interface Plan {
  id: string;
  name: string;
  priceThb: number;
  billingInterval: "month" | "year";
  features: string[];
}

export interface Subscription {
  planId: string;
  planName: string;
  priceThb: number;
  billingInterval: "month" | "year";
  status: "active" | "canceled" | "expired";
  provider: "mock" | "stripe" | "opn";
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface Account {
  profile: { id: string; displayName: string; createdAt: string } | null;
  subscription: Subscription | null;
  isPlus: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
