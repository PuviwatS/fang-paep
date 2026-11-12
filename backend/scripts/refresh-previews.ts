import path from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";

const BATCH_SIZE = 150;
const LOOKUP_URL = "https://itunes.apple.com/lookup";
type LookupResult = { trackId: number; previewUrl?: string; artworkUrl100?: string; trackViewUrl?: string };
type FetchLike = (input: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export async function refreshPreviews(pool: Pool, fetcher: FetchLike = fetch): Promise<number[]> {
  const songs = await pool.query<{ id: string }>("SELECT id FROM songs WHERE active ORDER BY id");
  const ids = songs.rows.map((song) => Number(song.id));
  const missing: number[] = [];
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = ids.slice(start, start + BATCH_SIZE);
    const response = await fetcher(`${LOOKUP_URL}?id=${batch.join(",")}&country=th`);
    if (!response.ok)
      throw new Error(
        `iTunes lookup failed with status ${response.status} for songs ${batch[0]}-${batch.at(-1)}`,
      );
    const body = (await response.json()) as { results?: unknown };
    if (!Array.isArray(body.results)) throw new Error("iTunes lookup returned no results array");
    const rows = (body.results as LookupResult[])
      .filter((track) => Number.isSafeInteger(track.trackId) && track.previewUrl)
      .map((track) => [
        track.trackId,
        track.previewUrl!,
        track.artworkUrl100?.replace("100x100bb", "300x300bb") ?? null,
        track.trackViewUrl ?? null,
      ]);
    const found = new Set(rows.map(([id]) => id));
    missing.push(...batch.filter((id) => !found.has(id)));
    if (rows.length) {
      await pool.query(
        "INSERT INTO song_previews(song_id,preview_url,artwork_url,track_url,updated_at) SELECT * FROM unnest($1::bigint[],$2::text[],$3::text[],$4::text[],array_fill(now(), array[array_length($1::bigint[], 1)])) ON CONFLICT(song_id) DO UPDATE SET preview_url=excluded.preview_url, artwork_url=excluded.artwork_url, track_url=excluded.track_url, updated_at=excluded.updated_at",
        [
          rows.map(([id]) => id),
          rows.map(([, preview]) => preview),
          rows.map(([, , artwork]) => artwork),
          rows.map(([, , , track]) => track),
        ],
      );
    }
    console.log(`Refreshed ${Math.min(start + BATCH_SIZE, ids.length)}/${ids.length}`);
  }
  return missing;
}

if (require.main === module) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: databaseUrl });
  refreshPreviews(pool)
    .then((missing) => {
      if (missing.length)
        console.warn(`No iTunes TH preview for ${missing.length} songs: ${missing.join(", ")}`);
    })
    .finally(() => pool.end())
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
