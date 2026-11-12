import type { PoolClient } from "pg";
import { transaction } from "../config/db";

type Actor = { id?: string };

/** Runs each database operation in one transaction and clears identity on commit/rollback. */
export async function gameTransaction<T>(actor: Actor, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return transaction(async (client) => {
    await client.query("SELECT set_config('app.user_id', $1, true)", [actor.id ?? ""]);
    if (actor.id) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [actor.id]);
    return fn(client);
  });
}

export async function gameCall<T>(actor: Actor, functionName: string, args: unknown[] = []): Promise<T> {
  const placeholders = args.map((_, index) => `$${index + 1}`).join(", ");
  return gameTransaction(actor, async (client) => {
    const result = await client.query<{ value: T }>(`SELECT ${functionName}(${placeholders}) AS value`, args);
    return result.rows[0].value;
  });
}
