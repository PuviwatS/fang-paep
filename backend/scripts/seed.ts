import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import dotenv from "dotenv";

/** Loads the supplied catalog and 730-day puzzle schedule idempotently. */
export async function seed(pool: Pool, seedDirectory: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const name of ["01_catalog.sql", "02_daily_puzzles.sql"])
      await client.query(await readFile(path.join(seedDirectory, name), "utf8"));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url });
  const directory = path.resolve(process.cwd(), "migrations/seeds");
  seed(pool, directory)
    .then(() => pool.end())
    .catch(async (error) => {
      await pool.end();
      throw error;
    });
}
