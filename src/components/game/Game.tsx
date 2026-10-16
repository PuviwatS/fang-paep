"use client";

import { useMemo, useState } from "react";
import { AdSlot } from "@/components/monetization/AdSlot";
import { PlusCard } from "@/components/monetization/PlusCard";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { useAudioClip } from "@/hooks/useAudioClip";
import { useFirstVisitHelp } from "@/hooks/useFirstVisit";
import { useGame } from "@/hooks/useGame";
import { usePreview } from "@/hooks/usePreview";
import { getDayNumber } from "@/lib/daily";
import { unlockedSeconds } from "@/lib/scoring";
import type { Category, GameMode, Song } from "@/lib/types";
import { CategoryTabs } from "./CategoryTabs";
import styles from "./Game.module.css";
import { GameHeader } from "./GameHeader";
import { GuessInput } from "./GuessInput";
import { GuessList } from "./GuessList";
import { HelpDialog } from "./HelpDialog";
import { ModeToggle } from "./ModeToggle";
import { Player } from "./Player";
import { ResultCard } from "./ResultCard";

/** Top-level screen. Wires the game state, audio and UI pieces together. */
export function Game() {
  const day = useMemo(() => getDayNumber(), []);
  const [category, setCategory] = useState<Category>("all");
  const [mode, setMode] = useState<GameMode>("daily");
  const [isHelpOpen, setHelpOpen] = useFirstVisitHelp();

  const game = useGame(mode, category, day);
  const { preview, isLoading, error: previewError } = usePreview(game.answer.id);
  const audio = useAudioClip(preview?.previewUrl ?? null);

  const unlocked = unlockedSeconds(game.guesses);
  const guessedIds = useMemo(
    () => new Set(game.guesses.flatMap((guess) => (guess.song ? [guess.song.id] : []))),
    [game.guesses],
  );

  function togglePlayback() {
    if (audio.isPlaying) audio.stop();
    else void audio.play(unlocked);
  }

  function handleGuess(song: Song) {
    audio.stop();
    game.submitGuess(song);
  }

  function handleSkip() {
    audio.stop();
    game.skip();
  }

  return (
    <div className={styles.page}>
      <GameHeader day={day} onOpenHelp={() => setHelpOpen(true)} />
      <CategoryTabs value={category} onChange={setCategory} />
      <ModeToggle value={mode} onChange={setMode} />

      <GuessList guesses={game.guesses} finished={game.finished} />

      <Player
        unlockedSeconds={unlocked}
        position={audio.position}
        isPlaying={audio.isPlaying}
        isReady={Boolean(preview)}
        isLoading={isLoading}
        error={previewError ?? audio.error}
        onToggle={togglePlayback}
      />

      {game.finished ? (
        <ResultCard
          answer={game.answer}
          preview={preview}
          guesses={game.guesses}
          won={game.won}
          mode={mode}
          day={day}
          category={category}
          stats={game.stats}
          onNextSong={game.nextSong}
        />
      ) : (
        <GuessInput
          attemptsUsed={game.guesses.length}
          guessedIds={guessedIds}
          onGuess={handleGuess}
          onSkip={handleSkip}
        />
      )}

      <aside className={styles.monetization} aria-label="ตัวอย่างพื้นที่สร้างรายได้">
        <AdSlot />
        <PlusCard />
      </aside>

      <SiteFooter />

      {isHelpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
