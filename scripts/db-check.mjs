import pg from "pg";
import { databaseConnectionOptions } from "../lib/db/connection-options.mjs";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env.local");
const pool = new pg.Pool({ ...databaseConnectionOptions(process.env.DATABASE_URL), max: 1, connectionTimeoutMillis: 10000 });
try { const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"); console.log(result.rows); } finally { await pool.end(); }
