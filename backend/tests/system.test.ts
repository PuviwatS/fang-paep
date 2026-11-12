import path from "node:path";
import request from "supertest";
import { Pool } from "pg";
import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../scripts/migrate";
import { seed } from "../scripts/seed";
import { resetTestDatabase, testDatabaseUrl } from "../src/test-db";

describe.skipIf(!process.env.TEST_DATABASE_URL)("HTTP feature parity", () => {
  let app: Express;
  let pool: Pool;
  let appDatabase: Pool;
  const mail: { to: string; text: string }[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    process.env.FRONTEND_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "http-parity-access-test-secret-123456789";
    process.env.JWT_REFRESH_SECRET = "http-parity-refresh-test-secret-123456789";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await resetTestDatabase(pool);
    await migrate(pool, path.resolve(__dirname, "../migrations"));
    await seed(pool, path.resolve(__dirname, "../migrations/seeds"));
    const [{ createApp }, database] = await Promise.all([import("../src/app"), import("../src/config/db")]);
    appDatabase = database.db;
    app = createApp({
      mailer: {
        send: async (message) => {
          mail.push(message);
        },
      },
    });
  });

  afterAll(async () => {
    await appDatabase?.end();
    await pool?.end();
  });

  async function register(email: string) {
    const agent = request.agent(app).set("Origin", "http://localhost:3000");
    await agent
      .post("/api/auth/signup")
      .send({ email, password: "password123", displayName: email.split("@")[0] })
      .expect(201);
    const message = mail.find((entry) => entry.to === email);
    expect(message).toBeDefined();
    const link = new URL(message!.text.match(/https?:\/\/\S+/)![0]);
    await agent
      .post("/api/auth/verify-email")
      .send({ token: link.searchParams.get("token") })
      .expect(200);
    return agent;
  }

  it("serves numeric catalog IDs and hides unfinished answers in every daily category", async () => {
    const catalog = await request(app).get("/api/songs").expect(200);
    expect(catalog.body.length).toBeGreaterThan(0);
    expect(typeof catalog.body[0].id).toBe("number");
    expect(typeof catalog.body[0].year).toBe("string");
    expect(catalog.body[0]).not.toHaveProperty("preview_url");
    for (const category of ["all", "pop", "rock", "luk", "hiphop"]) {
      const puzzle = await request(app).get(`/api/puzzle?category=${category}`).expect(200);
      expect(puzzle.body.answer).toBeNull();
      expect(puzzle.body.guesses).toEqual([]);
      expect(puzzle.body.finished).toBe(false);
    }
    await request(app).get("/api/account").expect(401);
    await request(app).get("/api/puzzle?category=unknown").expect(400);
  });

  it("preserves imports, saved rounds, stats, ownership, Plus controls and logout across HTTP routes", async () => {
    const alice = await register("alice@example.test");
    const bob = await register("bob@example.test");
    const today = (await pool.query<{ day: number }>("SELECT private.current_game_day() AS day")).rows[0].day;
    const answer = async (category: string) =>
      Number(
        (
          await pool.query<{ song_id: string }>(
            "SELECT song_id FROM daily_puzzles WHERE day=$1 AND category=$2",
            [today, category],
          )
        ).rows[0].song_id,
      );
    const importBody = {
      games: [{ day: today, category: "all", guesses: [{ songId: await answer("all") }] }],
    };
    const imported = await alice.post("/api/import-local").send(importBody).expect(200);
    expect(imported.body.imported).toBe(1);
    expect((await alice.post("/api/import-local").send(importBody).expect(200)).body.imported).toBe(0);
    const importedBoard = await alice.get("/api/leaderboard?category=all").expect(200);
    expect(importedBoard.body.entries).toEqual([]);
    expect((await alice.get("/api/stats?category=all").expect(200)).body.played).toBe(1);

    const guess = await alice
      .post("/api/guess")
      .send({ day: today, category: "pop", songId: await answer("pop"), attempt: 0 })
      .expect(200);
    expect(guess.body.finished).toBe(true);
    expect(guess.body.won).toBe(true);
    expect(guess.body.answer.id).toBe(await answer("pop"));
    const saved = await alice.get("/api/puzzle?category=pop").expect(200);
    expect(saved.body.guesses).toHaveLength(1);
    expect(saved.body.finished).toBe(true);
    const other = await bob.get("/api/puzzle?category=pop").expect(200);
    expect(other.body.guesses).toEqual([]);
    expect(other.body.answer).toBeNull();
    const guest = await request(app).get("/api/puzzle?category=pop").expect(200);
    expect(guest.body.guesses).toEqual([]);
    expect(guest.body.answer).toBeNull();
    expect((await bob.get("/api/stats?category=pop").expect(200)).body.played).toBe(0);
    const board = await alice.get("/api/leaderboard?category=pop").expect(200);
    expect(board.body.entries).toHaveLength(1);
    expect(board.body.entries[0].isMe).toBe(true);
    await alice.get(`/api/puzzle?category=all&day=${today - 1}`).expect(403);
    const plans = await request(app).get("/api/plans").expect(200);
    expect(plans.body.length).toBeGreaterThan(0);
    const checkout = await alice
      .post("/api/subscription/checkout")
      .send({ planId: plans.body[0].id })
      .expect(200);
    expect(checkout.body.isPlus).toBe(true);
    await alice.get(`/api/puzzle?category=all&day=${today - 1}`).expect(200);
    const canceled = await alice.post("/api/subscription/cancel").send({}).expect(200);
    expect(canceled.body.isPlus).toBe(true);
    expect(canceled.body.subscription.cancelAtPeriodEnd).toBe(true);
    const resumed = await alice.post("/api/subscription/resume").send({}).expect(200);
    expect(resumed.body.subscription.cancelAtPeriodEnd).toBe(false);
    expect((await bob.get("/api/account").expect(200)).body.isPlus).toBe(false);
    await alice
      .post("/api/auth/signout")
      .send({})
      .expect((response) => expect([200, 204]).toContain(response.status));
    await alice.get("/api/account").expect(401);
  });

  it("reveals a guest answer only after the sixth skipped attempt without saving a player result", async () => {
    const puzzle = await request(app).get("/api/puzzle?category=rock").expect(200);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app)
        .post("/api/guess")
        .send({
          day: puzzle.body.day,
          category: "rock",
          songId: null,
          attempt,
        })
        .expect(200);
      expect(response.body.tries).toBe(attempt + 1);
      expect(response.body.finished).toBe(attempt === 5);
      if (attempt < 5) expect(response.body.answer).toBeNull();
      else expect(response.body.answer.id).toEqual(expect.any(Number));
    }
    expect(
      (await pool.query("SELECT count(*) AS count FROM game_results WHERE category='rock'")).rows[0].count,
    ).toBe("0");
  });

  it("serializes concurrent first checkouts so both purchased mock periods are retained", async () => {
    const player = await register("parallel@example.test");
    const results = await Promise.all([
      player.post("/api/subscription/checkout").send({ planId: "plus_monthly" }),
      player.post("/api/subscription/checkout").send({ planId: "plus_monthly" }),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    const result = await pool.query<{ extended: boolean; payments: string }>(
      `SELECT s.current_period_end >= now() + interval '2 months' - interval '1 minute' AS extended,
       (SELECT count(*) FROM payments WHERE user_id=u.id) AS payments
       FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE u.email=$1`,
      ["parallel@example.test"],
    );
    expect(result.rows[0]).toEqual({ extended: true, payments: "2" });
  });

  it("keeps simultaneous authenticated attempts and stats consistent through the production pool", async () => {
    const player = await register("guesses@example.test");
    const puzzle = await player.get("/api/puzzle?category=hiphop").expect(200);
    const answer = Number(
      (
        await pool.query<{ song_id: string }>(
          "SELECT song_id FROM daily_puzzles WHERE day=$1 AND category='hiphop'",
          [puzzle.body.day],
        )
      ).rows[0].song_id,
    );
    const outcomes = await Promise.all([
      player
        .post("/api/guess")
        .send({ day: puzzle.body.day, category: "hiphop", songId: answer, attempt: 0 }),
      player
        .post("/api/guess")
        .send({ day: puzzle.body.day, category: "hiphop", songId: answer, attempt: 0 }),
    ]);
    expect(outcomes.map((response) => response.status).sort()).toEqual([200, 409]);
    const stats = await player.get("/api/stats?category=hiphop").expect(200);
    expect(stats.body.played).toBe(1);
    expect(stats.body.wins).toBe(1);
    const progress = await player.get("/api/puzzle?category=hiphop").expect(200);
    expect(progress.body.guesses).toHaveLength(1);
    const guest = await request(app).get("/api/puzzle?category=hiphop").expect(200);
    expect(guest.body.answer).toBeNull();
    expect(guest.body.guesses).toEqual([]);
  });
});
