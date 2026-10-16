import { describe, expect, it } from "vitest";
import { getDailySong, getDayNumber, getRandomSong, msUntilNextDay } from "./daily";
import { songsInCategory } from "./songs";

describe("getDayNumber", () => {
  it("is game #1 on 1 October 2026 in Thailand", () => {
    expect(getDayNumber(new Date("2026-10-01T00:00:00+07:00"))).toBe(1);
    expect(getDayNumber(new Date("2026-10-01T23:59:59+07:00"))).toBe(1);
  });

  it("changes at Thai midnight, not UTC midnight", () => {
    // 17:00 UTC on 1 Oct is already 00:00 on 2 Oct in Bangkok.
    expect(getDayNumber(new Date("2026-10-01T17:00:00Z"))).toBe(2);
  });
});

describe("msUntilNextDay", () => {
  it("counts down to Thai midnight", () => {
    expect(msUntilNextDay(new Date("2026-10-01T23:00:00+07:00"))).toBe(60 * 60 * 1000);
  });
});

describe("getDailySong", () => {
  it("gives everyone the same song on the same day", () => {
    expect(getDailySong("rock", 42)).toEqual(getDailySong("rock", 42));
  });

  it("only picks songs from the chosen category", () => {
    for (let day = 1; day <= 30; day++) {
      expect(getDailySong("luk", day).category).toBe("luk");
    }
  });

  it("does not repeat a song until the whole category has been used", () => {
    const pool = songsInCategory("hiphop");
    const ids = new Set(pool.map((_, i) => getDailySong("hiphop", i + 1).id));
    expect(ids.size).toBe(pool.length);
  });
});

describe("getRandomSong", () => {
  it("avoids the previous song", () => {
    const previous = getDailySong("pop", 1);
    for (let i = 0; i < 20; i++) {
      expect(getRandomSong("pop", previous.id).id).not.toBe(previous.id);
    }
  });
});
