"use client";

import { useCallback, useEffect, useState } from "react";
import { getDailySong, getRandomSong } from "@/lib/daily";
import { evaluateGuess, isFinished, isWon } from "@/lib/scoring";
import { getSongById } from "@/lib/songs";
import { loadDailyGame, recordDailyResult, saveDailyGame } from "@/lib/storage";
import type { Category, GameMode, Guess, PlayerStats, Song } from "@/lib/types";

/** Everything about one round. Mode, category and day travel with the guesses so saves never mix. */
interface Round {
  key: string;
  mode: GameMode;
  category: Category;
  day: number;
  answer: Song;
  guesses: Guess[];
}

function roundKey(mode: GameMode, category: Category, day: number): string {
  return `${mode}:${category}:${day}`;
}

function createRound(mode: GameMode, category: Category, day: number, previousAnswerId?: number): Round {
  const key = roundKey(mode, category, day);

  if (mode === "practice") {
    return { key, mode, category, day, answer: getRandomSong(category, previousAnswerId), guesses: [] };
  }

  const guesses: Guess[] = loadDailyGame(day, category).map((saved) => ({
    result: saved.result,
    song: saved.songId ? getSongById(saved.songId) : undefined,
  }));
  return { key, mode, category, day, answer: getDailySong(category, day), guesses };
}

export interface GameController {
  answer: Song;
  guesses: Guess[];
  won: boolean;
  finished: boolean;
  /** Stats after the daily game ends. Null in practice mode or while playing. */
  stats: PlayerStats | null;
  submitGuess: (song: Song) => void;
  skip: () => void;
  /** Practice mode only: start a new random song. */
  nextSong: () => void;
}

export function useGame(mode: GameMode, category: Category, day: number): GameController {
  const [round, setRound] = useState<Round>(() => createRound(mode, category, day));
  const [stats, setStats] = useState<PlayerStats | null>(null);

  // Start a new round when the mode, category or day changes.
  const key = roundKey(mode, category, day);
  useEffect(() => {
    setRound((current) =>
      current.key === key ? current : createRound(mode, category, day, current.answer.id),
    );
  }, [key, mode, category, day]);

  const won = isWon(round.guesses);
  const finished = isFinished(round.guesses);

  // Save daily progress, and record stats once the daily game is over.
  useEffect(() => {
    if (round.mode !== "daily") {
      setStats(null);
      return;
    }
    saveDailyGame(
      round.day,
      round.category,
      round.guesses.map((guess) => ({ result: guess.result, songId: guess.song?.id })),
    );
    setStats(finished ? recordDailyResult(round.category, round.day, won) : null);
  }, [round, finished, won]);

  const submitGuess = useCallback((song: Song) => {
    setRound((current) =>
      isFinished(current.guesses)
        ? current
        : {
            ...current,
            guesses: [...current.guesses, { result: evaluateGuess(song, current.answer), song }],
          },
    );
  }, []);

  const skip = useCallback(() => {
    setRound((current) =>
      isFinished(current.guesses)
        ? current
        : { ...current, guesses: [...current.guesses, { result: "skip" }] },
    );
  }, []);

  const nextSong = useCallback(() => {
    setRound((current) =>
      current.mode === "practice"
        ? createRound("practice", current.category, current.day, current.answer.id)
        : current,
    );
  }, []);

  return { answer: round.answer, guesses: round.guesses, won, finished, stats, submitGuess, skip, nextSong };
}
