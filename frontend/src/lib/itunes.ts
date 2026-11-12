import { ITUNES_COUNTRY, ITUNES_LOOKUP_URL } from "./constants";
import type { Preview } from "./types";

interface ItunesLookupResponse {
  results?: Array<{
    previewUrl?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
  }>;
}

/**
 * Get the 30-second preview for a track from the iTunes Lookup API.
 * We keep only the trackId and fetch the URL when needed; no audio is downloaded or stored.
 */
export async function fetchPreview(trackId: number): Promise<Preview> {
  const url = `${ITUNES_LOOKUP_URL}?id=${trackId}&country=${ITUNES_COUNTRY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`iTunes lookup failed with status ${response.status}`);
  }

  const data = (await response.json()) as ItunesLookupResponse;
  const track = data.results?.[0];
  if (!track?.previewUrl) {
    throw new Error(`No preview available for track ${trackId}`);
  }

  return {
    previewUrl: track.previewUrl,
    // iTunes serves other artwork sizes by changing the size in the URL.
    artworkUrl: (track.artworkUrl100 ?? "").replace("100x100bb", "300x300bb"),
    trackUrl: track.trackViewUrl ?? "",
  };
}
