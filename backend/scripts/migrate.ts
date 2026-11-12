import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import dotenv from "dotenv";

export type Migration = { name: string; sequence: number; sql: string; checksum: string };
const migrationName = /^(.+)_(\d+)\.sql$/;

export async function loadMigrations(directory: string): Promise<Migration[]> {
  const files = await readdir(directory);
  const malformed = files.filter((file) => file.endsWith(".sql") && !migrationName.test(file));
  if (malformed.length) throw new Error(`Malformed migration filename: ${malformed.join(", ")}`);
  const migrations = await Promise.all(
    files
      .filter((file) => migrationName.test(file))
      .map(async (name) => {
        const match = name.match(migrationName)!;
        const sql = await readFile(path.join(directory, name), "utf8");
        return {
          name,
          sequence: Number(match[2]),
          sql,
          checksum: createHash("sha256").update(sql).digest("hex"),
        };
      }),
  );
  migrations.sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name));
  for (let index = 1; index < migrations.length; index += 1)
    if (migrations[index - 1].sequence === migrations[index].sequence)
      throw new Error(`Duplicate migration sequence ${migrations[index].sequence}`);
  return migrations;
}

async function ledger(client: PoolClient): Promise<void> {
  await client.query("CREATE SCHEMA IF NOT EXISTS private");
  await client.query(
    "CREATE TABLE IF NOT EXISTS private.schema_migrations (filename text PRIMARY KEY, sequence integer NOT NULL UNIQUE, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
}
export async function migrate(pool: Pool, directory: string): Promise<void> {
  const migrations = await loadMigrations(directory);
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(892091187)");
    await ledger(client);
    const applied = await client.query<{ filename: string; sequence: number; checksum: string }>(
      "SELECT filename,sequence,checksum FROM private.schema_migrations ORDER BY sequence",
    );
    const files = new Map(migrations.map((migration) => [migration.name, migration]));
    for (const [index, prior] of applied.rows.entries()) {
      const current = files.get(prior.filename);
      if (!current) throw new Error(`Applied migration missing: ${prior.filename}`);
      if (current.sequence !== prior.sequence || current.checksum !== prior.checksum)
        throw new Error(`Applied migration changed: ${prior.filename}`);
      if (migrations[index]?.name !== prior.filename)
        throw new Error(`Applied migrations are out of order at ${prior.filename}`);
    }
    for (const migration of migrations)
      if (!applied.rows.some((prior) => prior.filename === migration.name)) {
        await client.query("BEGIN");
        try {
          await client.query(migration.sql);
          await client.query(
            "INSERT INTO private.schema_migrations(filename,sequence,checksum) VALUES($1,$2,$3)",
            [migration.name, migration.sequence, migration.checksum],
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(892091187)");
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url });
  migrate(pool, path.resolve(process.cwd(), "migrations"))
    .then(() => pool.end())
    .catch(async (error) => {
      await pool.end();
      throw error;
    });
}
