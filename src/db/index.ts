import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

// With DATABASE_URL set (staging/production) we talk to a real Postgres server.
// Without it (local development) we use PGlite: real Postgres running in-process,
// stored in .data/pglite. PGlite allows only one open instance per data folder,
// so the instance is cached on globalThis to survive Next.js hot reloads.
const globalForDb = globalThis as unknown as { tibaDb?: Db; tibaPglite?: PGlite };

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (url) {
    return drizzlePostgres(postgres(url), { schema });
  }
  const dataDir = process.env.PGLITE_DIR ?? ".data/pglite";
  mkdirSync(dataDir, { recursive: true });
  const client = (globalForDb.tibaPglite ??= new PGlite(
    dataDir,
    { extensions: { pg_trgm } },
  ));
  // Both drivers expose the same query API; the cast keeps one Db type app-wide.
  return drizzlePglite(client, { schema }) as unknown as Db;
}

export const db = (globalForDb.tibaDb ??= createDb());
export { globalForDb as _dbGlobals };
