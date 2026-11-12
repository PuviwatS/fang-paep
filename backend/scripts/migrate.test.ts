import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrate } from "./migrate";
import { generateSeed } from "./generate-seed";
import { seed } from "./seed";
import { hasTestDatabase, resetTestDatabase, testPool } from "../src/test-db";

const pool = testPool();
const migrations = path.resolve(__dirname, "../migrations");
beforeEach(async () => {
  await resetTestDatabase(pool);
});
afterAll(async () => {
  await pool.end();
});

describe.skipIf(!hasTestDatabase())("migrate", () => {
  it("applies supplied migrations once and accepts a no-op rerun", async () => {
    await migrate(pool, migrations);
    await migrate(pool, migrations);
    const rows = await pool.query("SELECT filename FROM private.schema_migrations ORDER BY sequence");
    expect(rows.rows.map((row) => row.filename)).toEqual(["initial_schema_1.sql", "game_functions_2.sql"]);
  });
  it("rejects an applied migration whose checksum changes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fangpap-migrations-"));
    try {
      await writeFile(path.join(directory, "initial_1.sql"), "CREATE TABLE first_table (id integer);\n");
      await migrate(pool, directory);
      await writeFile(path.join(directory, "initial_1.sql"), "CREATE TABLE first_table (id bigint);\n");
      await expect(migrate(pool, directory)).rejects.toThrow("Applied migration changed");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("accepts legacy Windows line endings but still rejects a real SQL change", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fangpap-migrations-"));
    try {
      const windowsSql = "CREATE TABLE line_ending_check (id integer);\r\n";
      const filename = path.join(directory, "initial_1.sql");
      await writeFile(filename, windowsSql);
      await migrate(pool, directory);
      await pool.query("UPDATE private.schema_migrations SET checksum=$1", [
        createHash("sha256").update(windowsSql).digest("hex"),
      ]);
      await writeFile(filename, windowsSql.replace(/\r\n/g, "\n"));
      await expect(migrate(pool, directory)).resolves.toBeUndefined();
      expect((await pool.query("SELECT count(*) FROM private.schema_migrations")).rows[0].count).toBe("1");
      await writeFile(filename, "CREATE TABLE line_ending_check (id bigint);\n");
      await expect(migrate(pool, directory)).rejects.toThrow("Applied migration changed");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("rejects malformed and duplicate sequences while accepting numeric gaps", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fangpap-migrations-"));
    try {
      await writeFile(path.join(directory, "invalid.sql"), "select 1;");
      await expect(loadMigrations(directory)).rejects.toThrow("Malformed migration filename");
      await rm(path.join(directory, "invalid.sql"));
      await writeFile(path.join(directory, "first_1.sql"), "select 1;");
      await writeFile(path.join(directory, "other_1.sql"), "select 1;");
      await expect(loadMigrations(directory)).rejects.toThrow("Duplicate migration sequence");
      await rm(path.join(directory, "other_1.sql"));
      await writeFile(path.join(directory, "third_3.sql"), "select 1;");
      const loaded = await loadMigrations(directory);
      expect(loaded.map((migration) => migration.sequence)).toEqual([1, 3]);
      await migrate(pool, directory);
      await migrate(pool, directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("rejects a missing or out-of-order applied migration", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fangpap-migrations-"));
    try {
      await writeFile(path.join(directory, "first_1.sql"), "CREATE TABLE first_table (id integer);");
      await migrate(pool, directory);
      await rm(path.join(directory, "first_1.sql"));
      await expect(migrate(pool, directory)).rejects.toThrow("Applied migration missing");
      await resetTestDatabase(pool);
      await writeFile(path.join(directory, "first_1.sql"), "CREATE TABLE first_table (id integer);");
      await writeFile(path.join(directory, "second_2.sql"), "CREATE TABLE second_table (id integer);");
      const migrationsToApply = await loadMigrations(directory);
      await pool.query(
        "CREATE SCHEMA private; CREATE TABLE private.schema_migrations (filename text PRIMARY KEY, sequence integer UNIQUE NOT NULL, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      await pool.query("INSERT INTO private.schema_migrations(filename,sequence,checksum) VALUES($1,$2,$3)", [
        migrationsToApply[1].name,
        migrationsToApply[1].sequence,
        migrationsToApply[1].checksum,
      ]);
      await expect(migrate(pool, directory)).rejects.toThrow("out of order");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("rolls back a failed migration", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fangpap-migrations-"));
    try {
      await writeFile(
        path.join(directory, "first_1.sql"),
        "CREATE TABLE rollback_check (id integer); SELECT missing_sql_function();\n",
      );
      await expect(migrate(pool, directory)).rejects.toThrow();
      expect(
        (await pool.query("SELECT to_regclass('public.rollback_check') AS table_name")).rows[0].table_name,
      ).toBeNull();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("seeds the catalog and puzzle schedule idempotently", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fangpap-seed-"));
    try {
      await migrate(pool, migrations);
      await generateSeed(3, directory);
      await seed(pool, directory);
      const first = await pool.query<{ songs: string; puzzles: string }>(
        "SELECT (SELECT count(*) FROM songs) AS songs, (SELECT count(*) FROM daily_puzzles) AS puzzles",
      );
      await seed(pool, directory);
      const second = await pool.query<{ songs: string; puzzles: string }>(
        "SELECT (SELECT count(*) FROM songs) AS songs, (SELECT count(*) FROM daily_puzzles) AS puzzles",
      );
      expect(second.rows[0]).toEqual(first.rows[0]);
      expect(first.rows[0]).toEqual({ songs: expect.any(String), puzzles: "15" });
      expect(Number(first.rows[0].songs)).toBeGreaterThan(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
