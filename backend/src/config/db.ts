import { Pool, PoolClient, QueryResultRow } from "pg";
import { config } from ".";

export const db = new Pool({
  connectionString: config.databaseUrl,
});

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type Queryable = Pick<PoolClient, "query"> | Pick<Pool, "query">;
export type Row<T extends QueryResultRow> = T;
