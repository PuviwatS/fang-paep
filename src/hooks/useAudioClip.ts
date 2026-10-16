"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AudioClip {
  isPlaying: boolean;
  /** Current playback position in seconds. */
  position: number;
  error: string | null;
  /** Play from the start and stop automatically after `limitSeconds`. */
  play: (limitSeconds: number) => Promise<void>;
  stop: () => void;
}

/** Plays the first N seconds of an audio URL and reports the position for the progress bar. */
export function useAudioClip(src: string | null): AudioClip {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  // Load a new source and reset playback when the song changes.
  useEffect(() => {
    stop();
    setPosition(0);
    setError(null);
    if (!src) return;

    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.preload = "auto";
    audio.src = src;
    audio.load();
  }, [src, stop]);

  // Stop playback when the component using this hook unmounts.
  useEffect(() => stop, [stop]);

  const play = useCallback(
    async (limitSeconds: number) => {
      const audio = audioRef.current;
      if (!audio || !src) return;

      try {
        audio.currentTime = 0;
        await audio.play();
      } catch {
        setError("เบราว์เซอร์ไม่ยอมเล่นเสียง ลองกดอีกครั้ง");
        return;
      }

      setError(null);
      setIsPlaying(true);

      const tick = () => {
        const time = audio.currentTime;
        if (time >= limitSeconds || audio.ended) {
          audio.pause();
          setIsPlaying(false);
          setPosition(Math.min(time, limitSeconds));
          return;
        }
        setPosition(time);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    },
    [src],
  );

  return { isPlaying, position, error, play, stop };
}
