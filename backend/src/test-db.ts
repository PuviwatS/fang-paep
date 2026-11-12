import { Pool } from "pg";

export function testDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
  const url = new URL(value);
  if (
    !/(_test|test)$/i.test(url.pathname.replace(/^\//, "")) ||
    !["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  ) {
    throw new Error("TEST_DATABASE_URL must target a local database whose name ends in test");
  }
  return value;
}
export function hasTestDatabase(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL);
}
/** An unconfigured pool is harmless: integration suites skip before issuing a query. */
export function testPool(): Pool {
  return new Pool(hasTestDatabase() ? { connectionString: testDatabaseUrl() } : undefined);
}
export async function resetTestDatabase(pool: Pool): Promise<void> {
  await pool.query(
    "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS private CASCADE; CREATE SCHEMA public",
  );
}
