"""Workflow step 2: pull candidate songs for a list of artists from the iTunes Search API.

Usage:
    python scripts/fetch_itunes.py "Bodyslam" "Potato" "Tai Orathai" > candidates.csv

The output is a CSV to curate by hand (in Google Sheets, for example). Keep the songs
people actually know, fix the artist name, set the category, then copy the rows into
data/songs.json as [trackId, title, artist, category, year].

Only metadata and the trackId are kept. The game looks up the preview URL at play time,
so no audio is downloaded or stored.
"""

import csv
import json
import sys
import time
import urllib.parse
import urllib.request

SEARCH = "https://itunes.apple.com/search"
SKIP_WORDS = ("live", "piano", "remix", "cover", "version", "acoustic", "instrumental", "karaoke")


def search(artist: str, limit: int = 25) -> list[dict]:
    query = urllib.parse.urlencode(
        {"term": artist, "country": "th", "entity": "song", "limit": limit}
    )
    with urllib.request.urlopen(f"{SEARCH}?{query}", timeout=20) as resp:
        return json.load(resp).get("results", [])


def main(artists: list[str]) -> None:
    out = csv.writer(sys.stdout)
    out.writerow(["query", "trackId", "title", "artist", "year", "genre", "has_preview"])
    for artist in artists:
        seen = set()
        for r in search(artist):
            title = r.get("trackName", "")
            if any(w in title.lower() for w in SKIP_WORDS):
                continue
            key = (title.split("(")[0].strip(), r.get("artistName"))
            if key in seen:
                continue
            seen.add(key)
            out.writerow([
                artist,
                r.get("trackId"),
                title,
                r.get("artistName"),
                (r.get("releaseDate") or "")[:4],
                r.get("primaryGenreName"),
                bool(r.get("previewUrl")),
            ])
        time.sleep(3)  # stay well under iTunes' informal rate limit


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
