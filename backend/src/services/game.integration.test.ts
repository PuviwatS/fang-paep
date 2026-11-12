import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../scripts/migrate";
import { hasTestDatabase, resetTestDatabase, testPool } from "../test-db";

const pool = testPool();
const migrations = path.resolve(__dirname, "../../migrations");
const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";

async function setup(): Promise<number> {
  await resetTestDatabase(pool);
  await migrate(pool, migrations);
  const current = (await pool.query<{ day: number }>("SELECT private.current_game_day() AS day")).rows[0].day;
  await pool.query(
    "INSERT INTO users(id,email,password_hash,email_verified) VALUES($1,'a@test.local','x',true),($2,'b@test.local','x',true)",
    [userA, userB],
  );
  await pool.query("INSERT INTO profiles(id,display_name) VALUES($1,'A'),($2,'B')", [userA, userB]);
  await pool.query("INSERT INTO artists(name) VALUES('Artist')");
  await pool.query(
    "INSERT INTO songs(id,title,artist_id,category,active) VALUES(101,'Answer',1,'pop',true),(102,'Wrong',1,'pop',true)",
  );
  await pool.query("INSERT INTO song_previews(song_id,preview_url) VALUES(101,'https://example.test/audio')");
  await pool.query("INSERT INTO daily_puzzles(day,category,song_id) VALUES($1,'all',101),($1,'pop',101)", [
    current,
  ]);
  return current;
}
async function gameCall<T>(actor: { id?: string }, functionName: string, args: unknown[] = []): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [actor.id ?? ""]);
    const placeholders = args.map((_, index) => `$${index + 1}`).join(", ");
    const result = await client.query<{ value: T }>(`SELECT ${functionName}(${placeholders}) AS value`, args);
    await client.query("COMMIT");
    return result.rows[0].value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
beforeEach(setup);
afterAll(async () => {
  await pool.end();
});

describe.skipIf(!hasTestDatabase())("game PostgreSQL functions", () => {
  it("does not expose answers before finish and preserves per-user ownership", async () => {
    const day = (await pool.query<{ day: number }>("SELECT private.current_game_day() AS day")).rows[0].day;
    const puzzle = await gameCall<{ answer: unknown }>({}, "public.get_puzzle", ["all", day]);
    expect(puzzle.answer).toBeNull();
    await gameCall(userA ? { id: userA } : {}, "public.submit_guess", ["all", day, 101, 0]);
    const other = await gameCall<{ finished: boolean; answer: unknown }>({ id: userB }, "public.get_puzzle", [
      "all",
      day,
    ]);
    expect(other.finished).toBe(false);
    expect(other.answer).toBeNull();
  });
  it("serializes simultaneous guesses and records only one attempt", async () => {
    const day = (await pool.query<{ day: number }>("SELECT private.current_game_day() AS day")).rows[0].day;
    const calls = await Promise.allSettled([
      gameCall({ id: userA }, "public.submit_guess", ["all", day, 102, 0]),
      gameCall({ id: userA }, "public.submit_guess", ["all", day, 102, 0]),
    ]);
    expect(calls.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await pool.query("SELECT tries FROM game_results WHERE user_id=$1", [userA])).rows[0].tries).toBe(
      1,
    );
  });
  it("keeps imported games out of the live leaderboard", async () => {
    const day = (await pool.query<{ day: number }>("SELECT private.current_game_day() AS day")).rows[0].day;
    await gameCall({ id: userA }, "public.import_local_games", [
      JSON.stringify([{ day, category: "all", guesses: [{ songId: 101 }] }]),
    ]);
    const board = await gameCall<{ entries: unknown[] }>({ id: userA }, "public.get_leaderboard", [
      "all",
      day,
    ]);
    expect(board.entries).toEqual([]);
  });
});
