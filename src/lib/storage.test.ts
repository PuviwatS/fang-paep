import { beforeEach, describe, expect, it } from "vitest";
import { loadDailyGame, loadStats, recordDailyResult, saveDailyGame } from "./storage";

/** Minimal in-memory localStorage for Node. */
class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  clear() {
    this.items.clear();
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: storage });

beforeEach(() => storage.clear());

describe("loadDailyGame", () => {
  it("reads back what was saved", () => {
    saveDailyGame(16, "all", [{ result: "wrong", songId: 1 }, { result: "skip" }]);
    expect(loadDailyGame(16, "all")).toEqual([{ result: "wrong", songId: 1 }, { result: "skip" }]);
  });

  it("reads progress saved by the first demo version", () => {
    storage.setItem("fp:day:16:all", JSON.stringify({ guesses: [{ result: "artist", id: 42 }] }));
    expect(loadDailyGame(16, "all")).toEqual([{ result: "artist", songId: 42 }]);
  });

  it("treats broken or unexpected data as no progress instead of crashing", () => {
    for (const bad of ["not json", "null", "123", '{"x":1}', '[{"result":"nope"}, 5, null]']) {
      storage.setItem("fp:day:16:all", bad);
      expect(loadDailyGame(16, "all")).toEqual([]);
    }
  });
});

describe("stats", () => {
  it("reads stats saved by the first demo version", () => {
    storage.setItem("fp:stats:all", JSON.stringify({ played: 3, wins: 2, streak: 2, best: 2, lastDay: 15 }));
    expect(loadStats("all")).toEqual({ played: 3, wins: 2, streak: 2, bestStreak: 2, lastDay: 15 });
  });

  it("continues a streak on consecutive days and resets it after a loss", () => {
    recordDailyResult("all", 1, true);
    expect(recordDailyResult("all", 2, true).streak).toBe(2);
    const afterLoss = recordDailyResult("all", 3, false);
    expect(afterLoss).toMatchObject({ played: 3, wins: 2, streak: 0, bestStreak: 2 });
  });

  it("counts each day only once", () => {
    recordDailyResult("all", 5, true);
    expect(recordDailyResult("all", 5, true).played).toBe(1);
  });
});
