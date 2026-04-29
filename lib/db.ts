import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { kistaroPool?: Pool };

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    `postgres://${process.env.POSTGRES_USER || "kistaro"}:${process.env.POSTGRES_PASSWORD || "kistaro"}@${process.env.POSTGRES_HOST || "127.0.0.1"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "kistaro"}`
  );
}

export const db =
  globalForDb.kistaroPool ??
  new Pool({
    connectionString: getConnectionString(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.kistaroPool = db;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return db.query<T>(text, values);
}

export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  const result = await query<T>(text, values);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  const result = await query<T>(text, values);
  return result.rows[0] ?? null;
}

export async function withTransaction<T>(callback: () => Promise<T>) {
  const client = await db.connect();

  try {
    await client.query("begin");
    const result = await callback();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabaseConnection() {
  await query("select 1");
}
