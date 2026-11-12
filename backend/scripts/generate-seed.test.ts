import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateSeed } from "./generate-seed";

function ids(sql: string, category: string): number[] {
  const statement = sql.indexOf(`select t.day, '${category}'`);
  const start = sql.indexOf("array[", statement) + "array[".length;
  const end = sql.indexOf("]::bigint", start);
  if (statement < 0 || end < start) throw new Error(`Missing ${category} puzzle seed`);
  return sql.slice(start, end).split(",").map(Number);
}

describe("generateSeed", () => {
  it("keeps the original deterministic daily mapping through a cycle rollover", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fangpap-seed-"));
    try {
      await generateSeed(300, directory);
      const generated = await readFile(path.join(directory, "02_daily_puzzles.sql"), "utf8");
      const knownOriginal: Record<string, [number, number, number, number]> = {
        all: [1829232388, 1792794294, 1779814901, 1793167384],
        pop: [1684771000, 1247264006, 1829905640, 1829231857],
        rock: [1792749659, 1792751626, 1020804082, 1792751443],
        luk: [1793327942, 1756699639, 1793313229, 1016906402],
        hiphop: [1844797576, 1591762489, 1792881043, 1829217006],
      };
      const cycleEnds: Record<string, number> = { all: 240, pop: 88, rock: 72, luk: 44, hiphop: 36 };
      for (const [category, expected] of Object.entries(knownOriginal)) {
        const actual = ids(generated, category);
        const cycleEnd = cycleEnds[category];
        expect([actual[0], actual[1], actual[cycleEnd - 1], actual[cycleEnd]]).toEqual(expected);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
