import { describe, expect, it } from "vitest";
import { buildShareText, evaluateGuess, isFinished, isWon, unlockedSeconds } from "./scoring";
import { SONGS } from "./songs";
import type { Guess, Song } from "./types";

const byTitle = (title: string): Song => {
  const song = SONGS.find((s) => s.title === title);
  if (!song) throw new Error(`Test song not found: ${title}`);
  return song;
};

const kram = byTitle("คราม"); // Bodyslam
const ngomngai = byTitle("งมงาย"); // Bodyslam
const khihueng = byTitle("ขี้หึง"); // Silly Fools

describe("evaluateGuess", () => {
  it("marks the exact song as correct", () => {
    expect(evaluateGuess(kram, kram)).toBe("correct");
  });

  it("marks another song by the same artist as an artist match", () => {
    expect(evaluateGuess(ngomngai, kram)).toBe("artist");
  });

  it("marks a different artist as wrong", () => {
    expect(evaluateGuess(khihueng, kram)).toBe("wrong");
  });
});

describe("game progress", () => {
  const skip: Guess = { result: "skip" };

  it("unlocks a longer clip after each attempt", () => {
    expect(unlockedSeconds([])).toBe(0.5);
    expect(unlockedSeconds([skip])).toBe(1);
    expect(unlockedSeconds([skip, skip, skip])).toBe(4);
  });

  it("ends after a correct guess or after six attempts", () => {
    expect(isFinished([{ result: "correct", song: kram }])).toBe(true);
    expect(isFinished(Array(5).fill(skip))).toBe(false);
    expect(isFinished(Array(6).fill(skip))).toBe(true);
    expect(isWon(Array(6).fill(skip))).toBe(false);
  });
});

describe("buildShareText", () => {
  it("shows the winning clip length and one square per attempt", () => {
    const guesses: Guess[] = [
      { result: "wrong", song: khihueng },
      { result: "artist", song: ngomngai },
      { result: "correct", song: kram },
    ];
    expect(buildShareText(15, "rock", guesses)).toBe("ฟังแป๊บ #15 (ร็อก) 2 วิ\n🟥🟨🟩⬜⬜⬜");
  });

  it("says ไม่รอด when the player runs out of tries", () => {
    const guesses: Guess[] = Array(6).fill({ result: "skip" });
    expect(buildShareText(3, "all", guesses)).toBe("ฟังแป๊บ #3 (ทั้งหมด) ไม่รอด\n⬛⬛⬛⬛⬛⬛");
  });
});
