import { NextResponse } from "next/server";
import type { CatalogSong } from "@/lib/api/types";
import { getSupabasePublicClient } from "@/lib/supabase/server";
import type { SongCategory } from "@/lib/types";

// Built on request (not at build time), then cached by Vercel's CDN for an hour via Cache-Control.
export const dynamic = "force-dynamic";

/** GET /api/songs — every active song with its artist and Thai artist names, for the search box. */
export async function GET() {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("songs")
    .select("id, title, category, year, artists (name, aliases)")
    .order("id");

  if (error || !data) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "server_error", message: "โหลดรายชื่อเพลงไม่สำเร็จ" } },
      { status: 500 },
    );
  }

  const songs: CatalogSong[] = data.map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artists?.name ?? "",
    aliases: row.artists?.aliases ?? [],
    category: row.category as SongCategory,
    year: row.year ? String(row.year) : "",
  }));

  return NextResponse.json(songs, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
