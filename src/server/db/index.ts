import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Reuse the pool through Next.js development reloads. Connections open lazily.
const globalForDb = globalThis as unknown as { flowstatePool?: Pool };
export const pool =
  globalForDb.flowstatePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
if (process.env.NODE_ENV !== "production") globalForDb.flowstatePool = pool;
export const db = drizzle(pool, { schema });
