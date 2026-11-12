import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { refreshPreviews } from "./refresh-previews";

function poolWithSongs(ids: string[]) {
  const query = async (sql: string) =>
    sql.startsWith("SELECT") ? { rows: ids.map((id) => ({ id })) } : { rows: [] };
  return { query } as unknown as Pool;
}

describe("refreshPreviews", () => {
  it("upserts returned previews and reports songs without a preview", async () => {
    const queries: unknown[][] = [];
    const pool = {
      query: async (sql: string, values?: unknown[]) => {
        if (sql.startsWith("SELECT")) return { rows: [{ id: "1" }, { id: "2" }] };
        queries.push(values ?? []);
        return { rows: [] };
      },
    } as unknown as Pool;
    const missing = await refreshPreviews(pool, async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ trackId: 1, previewUrl: "https://preview", artworkUrl100: "https://art/100x100bb.jpg" }],
      }),
    }));
    expect(missing).toEqual([2]);
    expect(queries).toEqual([[[1], ["https://preview"], ["https://art/300x300bb.jpg"], [null]]]);
  });

  it("fails loudly for iTunes failures or malformed output", async () => {
    await expect(
      refreshPreviews(poolWithSongs(["1"]), async () => ({ ok: false, status: 503, json: async () => ({}) })),
    ).rejects.toThrow("503");
    await expect(
      refreshPreviews(poolWithSongs(["1"]), async () => ({ ok: true, status: 200, json: async () => ({}) })),
    ).rejects.toThrow("results array");
  });
});
