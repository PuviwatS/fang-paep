import { describe, expect, it } from "vitest";
import { normalize, searchSongs } from "./search";

describe("normalize", () => {
  it("lowercases and removes spaces and punctuation", () => {
    expect(normalize("Big Ass!")).toBe("bigass");
    expect(normalize("ไกลแค่ไหน คือ ใกล้")).toBe("ไกลแค่ไหนคือใกล้");
  });
});

describe("searchSongs", () => {
  const none = new Set<number>();

  it("finds a song by its Thai title", () => {
    expect(searchSongs("คราม", none).map((s) => s.title)).toContain("คราม");
  });

  it("finds songs by the artist's Thai name", () => {
    const results = searchSongs("บอดี้สแลม", none);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((s) => s.artist === "Bodyslam")).toBe(true);
  });

  it("ranks a title match above an artist match", () => {
    // "คิด" starts the title "คิดมาก" and appears in no artist name.
    const [first] = searchSongs("คิดมาก", none);
    expect(first.title).toBe("คิดมาก");
  });

  it("leaves out songs that were already guessed", () => {
    const [kram] = searchSongs("คราม", none);
    expect(searchSongs("คราม", new Set([kram.id]))).not.toContainEqual(kram);
  });

  it("returns nothing for an empty query", () => {
    expect(searchSongs("   ", none)).toEqual([]);
  });
});
