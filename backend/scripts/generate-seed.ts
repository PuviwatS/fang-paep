import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Category = "all" | "pop" | "rock" | "luk" | "hiphop";
type SongRow = [number, string, string, Exclude<Category, "all">, string];
type Song = { id: number; title: string; artist: string; category: Exclude<Category, "all">; year: string };
const categories: Category[] = ["all", "pop", "rock", "luk", "hiphop"];

function frontendDataDirectory(): string {
  const candidates = [
    path.resolve(process.cwd(), "frontend/src/data"),
    path.resolve(process.cwd(), "../frontend/src/data"),
    path.resolve(__dirname, "../../frontend/src/data"),
    path.resolve(__dirname, "../../../frontend/src/data"),
  ];
  const found = candidates.find((candidate) => existsSync(path.join(candidate, "songs.json")));
  if (!found) throw new Error("Could not find frontend/src/data/songs.json");
  return found;
}
function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
function sqlArray(values: string[]): string {
  return `array[${values.map(sqlText).join(", ")}]::text[]`;
}
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1)
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}
function dailySong(category: Category, day: number, songs: Song[]): Song {
  const pool = songs
    .filter((song) => category === "all" || song.category === category)
    .sort((a, b) => a.id - b.id);
  if (!pool.length) throw new Error(`No songs for ${category}`);
  const shuffled = [...pool];
  const next = random(hash(`${category}:${Math.floor((day - 1) / pool.length)}`));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(next() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled[(day - 1) % pool.length];
}

export async function generateSeed(
  days = 730,
  outputDirectory = path.resolve(process.cwd(), "migrations/seeds"),
): Promise<void> {
  if (!Number.isSafeInteger(days) || days < 1) throw new Error("days must be a positive integer");
  const dataDirectory = frontendDataDirectory();
  const songs = (JSON.parse(await readFile(path.join(dataDirectory, "songs.json"), "utf8")) as SongRow[]).map(
    ([id, title, artist, category, year]) => ({ id, title, artist, category, year }),
  );
  const aliases = JSON.parse(await readFile(path.join(dataDirectory, "artists.json"), "utf8")) as Record<
    string,
    string[]
  >;
  const artists = [...new Set(songs.map((song) => song.artist))];
  const artistRows = artists.map((name) => `  (${sqlText(name)}, ${sqlArray(aliases[name] ?? [])})`);
  const songRows = songs.map(
    (song) =>
      `  (${song.id}, ${sqlText(song.title)}, ${sqlText(song.artist)}, ${sqlText(song.category)}, ${song.year ? Number(song.year) : "null"})`,
  );
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "01_catalog.sql"),
    `-- Generated from frontend/src/data; do not edit.\ninsert into public.artists (name, aliases) values\n${artistRows.join(",\n")}\non conflict (name) do update set aliases = excluded.aliases;\n\ninsert into public.songs (id, title, artist_id, category, year)\nselect v.id, v.title, a.id, v.category, v.year\nfrom (values\n${songRows.join(",\n")}\n) as v (id, title, artist, category, year)\njoin public.artists a on a.name = v.artist\non conflict (id) do nothing;\n`,
  );
  const puzzles = categories.map(
    (category) =>
      `insert into public.daily_puzzles (day, category, song_id)\nselect t.day, ${sqlText(category)}, t.song_id\nfrom unnest(array[${Array.from({ length: days }, (_, index) => dailySong(category, index + 1, songs).id).join(",")}]::bigint[]) with ordinality as t (song_id, day)\non conflict (day, category) do nothing;`,
  );
  await writeFile(
    path.join(outputDirectory, "02_daily_puzzles.sql"),
    `-- Generated from frontend/src/data; do not edit. Days 1-${days}.\n${puzzles.join("\n\n")}\n`,
  );
}

if (require.main === module) {
  const days = process.argv[2] === undefined ? 730 : Number(process.argv[2]);
  generateSeed(days).then(() => console.log(`Generated ${days} days of catalog seeds.`));
}
