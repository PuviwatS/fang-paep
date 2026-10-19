"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSongCatalog } from "@/components/providers/SongCatalogProvider";
import { ApiRequestError, api } from "@/lib/api/client";
import type { Answer, GuessResponse, PuzzleResponse, ServerGuess } from "@/lib/api/types";
import { MAX_TRIES } from "@/lib/constants";
import {
  loadDailyAnswer,
  loadDailyGame,
  loadStats,
  recordDailyResult,
  saveDailyAnswer,
  saveDailyGame,
} from "@/lib/storage";
import type { Category, PlayerStats, Song } from "@/lib/types";
import type { Round } from "./round";

interface DailyState {
  status: Round["status"];
  error: string | null;
  day: number | null;
  today: number | null;
  previewUrl: string | null;
  guesses: ServerGuess[];
  answer: Answer | null;
  stats: PlayerStats | null;
}

const INITIAL: DailyState = {
  status: "loading",
  error: null,
  day: null,
  today: null,
  previewUrl: null,
  guesses: [],
  answer: null,
  stats: null,
};

const isWon = (guesses: readonly ServerGuess[]) => guesses.some((g) => g.result === "correct");
const isFinished = (guesses: readonly ServerGuess[]) => isWon(guesses) || guesses.length >= MAX_TRIES;

/**
 * The daily puzzle, checked on the server.
 * Logged-in players: progress and stats live in the database.
 * Guests: the server still checks every guess, and progress is kept in this browser.
 */
export function useDailyRound(category: Category, requestedDay: number | null, enabled: boolean): Round {
  const { ready: authReady, user } = useAuth();
  const { byId } = useSongCatalog();
  const loggedIn = Boolean(user);
  const [state, setState] = useState<DailyState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!enabled || !authReady) return;
    let cancelled = false;
    setState(INITIAL);

    const query = `category=${category}${requestedDay ? `&day=${requestedDay}` : ""}`;
    api
      .get<PuzzleResponse>(`/api/puzzle?${query}`)
      .then(async (puzzle) => {
        let guesses = puzzle.guesses;
        let answer = puzzle.answer;
        let stats: PlayerStats | null = null;

        if (!loggedIn) {
          guesses = loadDailyGame(puzzle.day, category).map((g) => ({
            result: g.result,
            songId: g.songId ?? null,
          }));
          answer = isFinished(guesses) ? loadDailyAnswer<Answer>(puzzle.day, category) : null;
          if (isFinished(guesses) && puzzle.day === puzzle.today) stats = loadStats(category);
        } else if (puzzle.finished && puzzle.day === puzzle.today) {
          stats = await api.get<PlayerStats>(`/api/stats?category=${category}`).catch(() => null);
        }

        if (!cancelled) {
          setState({
            status: "ready",
            error: null,
            day: puzzle.day,
            today: puzzle.today,
            previewUrl: puzzle.previewUrl,
            guesses,
            answer,
            stats,
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ApiRequestError ? error.message : "โหลดเพลงไม่สำเร็จ";
        setState({ ...INITIAL, status: "error", error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, authReady, loggedIn, category, requestedDay, reloadCount]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  const submit = useCallback(
    async (song: Song | null) => {
      if (state.status !== "ready" || state.day === null || isFinished(state.guesses) || submitting) return;
      setSubmitting(true);
      try {
        const response = await api.post<GuessResponse>("/api/guess", {
          category,
          day: state.day,
          songId: song?.id ?? null,
          attempt: state.guesses.length,
        });
        const guesses = [...state.guesses, { result: response.result, songId: song?.id ?? null }];
        let stats = response.stats;

        if (!loggedIn) {
          saveDailyGame(
            state.day,
            category,
            guesses.map((g) => ({ result: g.result, songId: g.songId ?? undefined })),
          );
          if (response.finished) {
            saveDailyAnswer(state.day, category, response.answer);
            if (state.day === state.today) stats = recordDailyResult(category, state.day, response.won);
          }
        }

        setState((current) => ({
          ...current,
          error: null,
          guesses,
          answer: response.finished ? response.answer : null,
          stats,
        }));
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === "already_finished") {
          reload();
          return;
        }
        const message = error instanceof ApiRequestError ? error.message : "ส่งคำตอบไม่สำเร็จ";
        setState((current) => ({ ...current, error: message }));
      } finally {
        setSubmitting(false);
      }
    },
    [state, submitting, category, loggedIn, reload],
  );

  const guesses = useMemo(
    () =>
      state.guesses.map((g) => ({
        result: g.result,
        song: g.songId ? byId.get(g.songId) : undefined,
      })),
    [state.guesses, byId],
  );

  return {
    status: state.status,
    error: state.error,
    day: state.day,
    today: state.today,
    previewUrl: state.previewUrl,
    guesses,
    finished: isFinished(state.guesses),
    won: isWon(state.guesses),
    answer: state.answer,
    stats: state.stats,
    submitting,
    submit,
    reload,
  };
}
