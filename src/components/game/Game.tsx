"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AdSlot } from "@/components/monetization/AdSlot";
import { PlusCard } from "@/components/monetization/PlusCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAudioClip } from "@/hooks/useAudioClip";
import { useDailyRound } from "@/hooks/useDailyRound";
import { useFirstVisitHelp } from "@/hooks/useFirstVisit";
import { usePracticeRound } from "@/hooks/usePracticeRound";
import { categorySchema } from "@/lib/api/schemas";
import { unlockedSeconds } from "@/lib/scoring";
import type { Category, GameMode, Song } from "@/lib/types";
import { CategoryTabs } from "./CategoryTabs";
import styles from "./Game.module.css";
import { GameToolbar } from "./GameToolbar";
import { GuessInput } from "./GuessInput";
import { GuessList } from "./GuessList";
import { HelpDialog } from "./HelpDialog";
import { ModeToggle } from "./ModeToggle";
import { Player } from "./Player";
import { ResultCard } from "./ResultCard";

/** Reads ?category= and ?day= so archive links open the right puzzle. */
function useInitialSelection(): { category: Category; day: number | null } {
  const params = useSearchParams();
  const category = categorySchema.safeParse(params.get("category"));
  const day = Number(params.get("day"));
  return {
    category: category.success ? category.data : "all",
    day: Number.isInteger(day) && day > 0 ? day : null,
  };
}

/** The game screen. Wires the round (daily or practice), audio and UI pieces together. */
export function Game() {
  const initial = useInitialSelection();
  const { user, isPlus } = useAuth();
  const [category, setCategory] = useState<Category>(initial.category);
  const [mode, setMode] = useState<GameMode>("daily");
  const [archiveDay, setArchiveDay] = useState<number | null>(initial.day);
  const [isHelpOpen, setHelpOpen] = useFirstVisitHelp();

  const daily = useDailyRound(category, archiveDay, mode === "daily");
  const practice = usePracticeRound(category, mode === "practice");
  const round = mode === "daily" ? daily : practice;

  const audio = useAudioClip(round.previewUrl);
  const unlocked = unlockedSeconds(round.guesses);
  const isArchive = mode === "daily" && round.day !== null && round.today !== null && round.day < round.today;

  const guessedIds = useMemo(
    () => new Set(round.guesses.flatMap((guess) => (guess.song ? [guess.song.id] : []))),
    [round.guesses],
  );

  function changeCategory(next: Category) {
    setArchiveDay(null);
    setCategory(next);
  }

  function togglePlayback() {
    if (audio.isPlaying) audio.stop();
    else void audio.play(unlocked);
  }

  function handleGuess(song: Song | null) {
    audio.stop();
    void round.submit(song);
  }

  return (
    <div className={styles.page}>
      <GameToolbar
        day={mode === "daily" ? round.day : null}
        isArchive={isArchive}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <CategoryTabs value={category} onChange={changeCategory} />
      <ModeToggle value={mode} onChange={setMode} />

      <GuessList guesses={round.guesses} finished={round.finished} />

      <Player
        unlockedSeconds={unlocked}
        position={audio.position}
        isPlaying={audio.isPlaying}
        isReady={round.status === "ready" && Boolean(round.previewUrl)}
        isLoading={round.status === "loading"}
        error={round.status === "error" ? round.error : audio.error}
        onToggle={togglePlayback}
      />

      {round.status === "error" && (
        <button className={styles.retry} onClick={round.reload}>
          ลองโหลดอีกครั้ง
        </button>
      )}

      {round.finished ? (
        <ResultCard
          answer={round.answer}
          guesses={round.guesses}
          won={round.won}
          mode={mode}
          day={round.day}
          isToday={!isArchive}
          category={category}
          stats={round.stats}
          loggedIn={Boolean(user)}
          onNextSong={practice.next}
        />
      ) : (
        <>
          <GuessInput
            attemptsUsed={round.guesses.length}
            guessedIds={guessedIds}
            disabled={round.submitting || round.status !== "ready"}
            onGuess={handleGuess}
            onSkip={() => handleGuess(null)}
          />
          {round.status === "ready" && round.error && (
            <p className={styles.inlineError} role="alert">
              {round.error}
            </p>
          )}
        </>
      )}

      {!isPlus && (
        <aside className={styles.monetization} aria-label="พื้นที่โฆษณาและสมาชิก">
          <AdSlot />
          <PlusCard />
        </aside>
      )}

      {isHelpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
