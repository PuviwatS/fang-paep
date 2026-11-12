"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { CatalogSong } from "@/lib/api/types";
import { createSearchIndex, type SearchIndex } from "@/lib/search";
import { ARTIST_ALIASES, SONGS } from "@/lib/songs";
import type { Song } from "@/lib/types";

interface SongCatalog {
  songs: readonly Song[];
  byId: ReadonlyMap<number, Song>;
  searchIndex: SearchIndex;
}

function buildCatalog(
  songs: readonly Song[],
  aliases: Readonly<Record<string, readonly string[]>>,
): SongCatalog {
  return {
    songs,
    byId: new Map(songs.map((song) => [song.id, song])),
    searchIndex: createSearchIndex(songs, aliases),
  };
}

// The songs bundled with the app, used until the live list from the database arrives.
const BUNDLED_CATALOG = buildCatalog(SONGS, ARTIST_ALIASES);

const SongCatalogContext = createContext<SongCatalog>(BUNDLED_CATALOG);

/** Loads the song list from /api/songs so songs added in the database show up in search. */
export function SongCatalogProvider({ children }: { children: ReactNode }) {
  const [remote, setRemote] = useState<CatalogSong[] | null>(null);

  useEffect(() => {
    api
      .get<CatalogSong[]>("/api/songs")
      .then(setRemote)
      .catch(() => setRemote(null));
  }, []);

  const catalog = useMemo(() => {
    if (!remote || remote.length === 0) return BUNDLED_CATALOG;
    const aliases: Record<string, string[]> = {};
    for (const song of remote) aliases[song.artist] = song.aliases;
    const songs: Song[] = remote.map(({ id, title, artist, category, year }) => ({
      id,
      title,
      artist,
      category,
      year,
    }));
    return buildCatalog(songs, aliases);
  }, [remote]);

  return <SongCatalogContext.Provider value={catalog}>{children}</SongCatalogContext.Provider>;
}

export function useSongCatalog(): SongCatalog {
  return useContext(SongCatalogContext);
}
