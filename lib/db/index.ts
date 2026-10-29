import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { attachDatabasePool } from "@vercel/functions/db-connections";
import * as schema from "./schema";
import { databaseConnectionOptions } from "./connection-options.mjs";
const globalDb = globalThis as unknown as { taxManagerPool?: pg.Pool };
function createPool() {
  const pool = new pg.Pool({
    ...databaseConnectionOptions(process.env.DATABASE_URL),
    max: 3,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    allowExitOnIdle: true,
    application_name: "tax-manager",
  });
  // pg removes a failed idle socket; handling its error avoids a process crash.
  // Do not retry writes: the first request may already have committed.
  pool.on("error", (error: NodeJS.ErrnoException) => {
    console.error("Idle database connection closed", { code: error.code ?? "UNKNOWN" });
  });
  if (process.env.VERCEL === "1") attachDatabasePool(pool);
  return pool;
}
export const pool = globalDb.taxManagerPool ?? createPool();
globalDb.taxManagerPool = pool;
export const db = drizzle(pool, { schema });
export * from "./schema";
