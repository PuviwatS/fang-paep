"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSongCatalog } from "@/components/providers/SongCatalogProvider";
import type { Answer } from "@/lib/api/types";
import { evaluateGuess, isFinished, isWon } from "@/lib/scoring";
import type { Category, Guess, Song } from "@/lib/types";
import type { Round } from "./round";
import { usePreview } from "./usePreview";

function pickRandom(songs: readonly Song[], category: Category, avoidId?: number): Song | null {
  const pool = songs.filter((s) => (category === "all" || s.category === category) && s.id !== avoidId);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

/**
 * Unlimited practice: a random song, checked in the browser. Nothing is saved and there is no
 * leaderboard, so the answer does not need to be hidden from the client here.
 */
export function usePracticeRound(category: Category, enabled: boolean): Round & { next: () => void } {
  const { songs } = useSongCatalog();
  const [song, setSong] = useState<Song | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const preview = usePreview(enabled && song ? song.id : null);

  const next = useCallback(() => {
    setSong((current) => pickRandom(songs, category, current?.id));
    setGuesses([]);
  }, [songs, category]);

  // New song when practice starts or the category changes.
  useEffect(() => {
    if (enabled) next();
  }, [enabled, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(
    async (guess: Song | null) => {
      if (!song || isFinished(guesses)) return;
      setGuesses((current) => [
        ...current,
        guess ? { result: evaluateGuess(guess, song), song: guess } : { result: "skip" },
      ]);
    },
    [song, guesses],
  );

  const finished = isFinished(guesses);
  const answer = useMemo<Answer | null>(
    () =>
      finished && song
        ? {
            id: song.id,
            title: song.title,
            artist: song.artist,
            year: song.year ? Number(song.year) : null,
            artworkUrl: preview.preview?.artworkUrl ?? null,
            trackUrl: preview.preview?.trackUrl ?? null,
          }
        : null,
    [finished, song, preview.preview],
  );

  return {
    status: !song || preview.isLoading ? "loading" : preview.error ? "error" : "ready",
    error: preview.error,
    day: null,
    today: null,
    previewUrl: preview.preview?.previewUrl ?? null,
    guesses,
    finished,
    won: isWon(guesses),
    answer,
    stats: null,
    submitting: false,
    submit,
    reload: next,
    next,
  };
}
