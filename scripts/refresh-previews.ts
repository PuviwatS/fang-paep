/**
 * Refreshes the iTunes preview URL, artwork and link of every active song in Supabase.
 * iTunes preview URLs change now and then, so run this every few weeks (or when a song won't play).
 *
 *   SUPABASE_SECRET_KEY=sb_secret_... npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts/refresh-previews.ts
 *
 * The secret key bypasses Row Level Security. Keep it in .env.local or your shell, never in git.
 */
import { createClient } from "@supabase/supabase-js";
import { ITUNES_COUNTRY, ITUNES_LOOKUP_URL } from "../src/lib/constants";

const BATCH_SIZE = 150; // iTunes lookup accepts many ids at once; stay well under its limit.

interface LookupResult {
  trackId: number;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.");
  }
  const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

  const { data: songs, error } = await supabase.from("songs").select("id").eq("active", true);
  if (error) throw error;
  const ids = songs.map((song) => song.id as number);
  console.log(`Looking up ${ids.length} songs…`);

  const missing: number[] = [];
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = ids.slice(start, start + BATCH_SIZE);
    const response = await fetch(`${ITUNES_LOOKUP_URL}?id=${batch.join(",")}&country=${ITUNES_COUNTRY}`);
    if (!response.ok) throw new Error(`iTunes lookup failed with status ${response.status}`);
    const { results = [] } = (await response.json()) as { results?: LookupResult[] };

    const rows = results
      .filter((track) => track.previewUrl)
      .map((track) => ({
        song_id: track.trackId,
        preview_url: track.previewUrl!,
        artwork_url: (track.artworkUrl100 ?? "").replace("100x100bb", "300x300bb") || null,
        track_url: track.trackViewUrl ?? null,
        updated_at: new Date().toISOString(),
      }));
    const found = new Set(rows.map((row) => row.song_id));
    missing.push(...batch.filter((id) => !found.has(id)));

    const { error: upsertError } = await supabase.from("song_previews").upsert(rows);
    if (upsertError) throw upsertError;
    console.log(`  ${Math.min(start + BATCH_SIZE, ids.length)}/${ids.length}`);
  }

  if (missing.length > 0) {
    console.warn(`No preview on iTunes TH for ${missing.length} songs: ${missing.join(", ")}`);
    console.warn("Consider setting songs.active = false for them.");
  }
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
