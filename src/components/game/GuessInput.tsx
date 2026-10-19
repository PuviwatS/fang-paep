"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useSongCatalog } from "@/components/providers/SongCatalogProvider";
import { SNIPPET_SECONDS } from "@/lib/constants";
import { searchSongs } from "@/lib/search";
import type { Song } from "@/lib/types";
import styles from "./GuessInput.module.css";

interface GuessInputProps {
  /** How many attempts have been used so far. */
  attemptsUsed: number;
  /** Songs already guessed, hidden from the suggestions. */
  guessedIds: ReadonlySet<number>;
  /** True while a guess is being checked. */
  disabled?: boolean;
  onGuess: (song: Song) => void;
  onSkip: () => void;
}

/** Search box with keyboard-navigable suggestions, plus the skip button. */
export function GuessInput({ attemptsUsed, guessedIds, disabled = false, onGuess, onSkip }: GuessInputProps) {
  const { searchIndex } = useSongCatalog();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(
    () => searchSongs(searchIndex, query, guessedIds),
    [searchIndex, query, guessedIds],
  );

  function choose(song: Song) {
    if (disabled) return;
    onGuess(song);
    setQuery("");
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[Math.min(activeIndex, results.length - 1)]);
    }
  }

  const isLastAttempt = attemptsUsed === SNIPPET_SECONDS.length - 1;
  const extraSeconds = isLastAttempt ? 0 : SNIPPET_SECONDS[attemptsUsed + 1] - SNIPPET_SECONDS[attemptsUsed];

  return (
    <div className={styles.bar}>
      <div className={styles.search}>
        <input
          id="song-search"
          className={styles.input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์ชื่อเพลงหรือศิลปิน เช่น คราม, บอดี้สแลม"
          autoComplete="off"
          aria-label="ค้นหาเพลง"
        />

        {results.length > 0 && (
          <ul className={styles.results} role="listbox" aria-label="ผลการค้นหา">
            {results.map((song, index) => (
              <li key={song.id} role="option" aria-selected={index === activeIndex}>
                <button
                  className={index === activeIndex ? `${styles.result} ${styles.active}` : styles.result}
                  onClick={() => choose(song)}
                  data-testid="search-result"
                >
                  <b>{song.title}</b>
                  <span>{song.artist}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button className={styles.skip} onClick={onSkip} disabled={disabled} data-testid="skip">
        {isLastAttempt ? "ยอมแพ้" : `ข้าม (+${extraSeconds} วิ)`}
      </button>
    </div>
  );
}
