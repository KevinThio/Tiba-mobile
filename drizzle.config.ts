import { defineConfig } from "drizzle-kit";

// Only `drizzle-kit generate` is used (it reads the schema, not the database).
// Apply migrations with `npm run db:migrate`, which works for PGlite and Postgres.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
