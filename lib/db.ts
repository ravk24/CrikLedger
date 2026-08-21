import { Pool, type PoolClient } from "pg";

// Transactional write path. DATABASE_URL should be the Supabase
// transaction pooler string (port 6543) in production — serverless
// functions exhaust direct connections, and the direct db.*:5432 host is
// IPv6-only, which a Vercel function cannot reach at all.
//
// Named explicitly rather than passed through as undefined: node-postgres
// silently falls back to libpq defaults (localhost:5432, the OS user) when
// the connection string is missing, so a deployment with no DATABASE_URL
// fails much later as a connection refused to a machine that was never
// the database. Say which variable is missing, at load, once.
let instance: Pool | null = null;

function getPool(): Pool {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set — the deployment has no database to talk to.",
      );
    }
    instance = new Pool({
      connectionString,
      max: 3,
      ssl: { rejectUnauthorized: false },
    });
  }
  return instance;
}

// A lazy Pool behind a Proxy, so all ~43 `pool.query(...)` call sites and
// their generics stay exactly as they were.
//
// Lazy on purpose, twice over. Importing this module must stay free:
// lib/nav.ts reaches it transitively through lib/session.ts, and the unit
// suite deliberately runs with no database (vitest.config.mts). And the
// check must not be `new Pool({ connectionString: undefined })`, which is
// what it was — node-postgres then falls back to libpq defaults and
// quietly dials localhost:5432, so a deployment with no DATABASE_URL
// reports a connection refused to a machine that was never the database.
// Fail on first use instead, naming the variable.
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
