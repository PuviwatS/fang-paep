import type { Answer } from "@/lib/api/types";
import type { Guess, PlayerStats, Song } from "@/lib/types";

/** What the game screen needs from a round, whether it is the daily puzzle or practice. */
export interface Round {
  status: "loading" | "ready" | "error";
  /** Message for the player when loading or the last guess failed. */
  error: string | null;
  /** Daily game number; null in practice mode. */
  day: number | null;
  today: number | null;
  previewUrl: string | null;
  guesses: Guess[];
  finished: boolean;
  won: boolean;
  /** Revealed once the round is over. */
  answer: Answer | null;
  stats: PlayerStats | null;
  submitting: boolean;
  /** Song = a guess, null = skip. */
  submit: (song: Song | null) => Promise<void>;
  reload: () => void;
}
