// Applies the SQL migrations in ./drizzle to whichever database src/db uses.
import "./load-env";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { db, _dbGlobals } from "../src/db";

async function main() {
  const config = { migrationsFolder: "drizzle" };
  if (process.env.DATABASE_URL) {
    await migratePostgres(db, config);
  } else {
    await migratePglite(db as unknown as PgliteDatabase, config);
  }
  await _dbGlobals.tibaPglite?.close();
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
