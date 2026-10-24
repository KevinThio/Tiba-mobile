// Vercel runs this instead of "build" (the "vercel-build" script). Production deploys first
// bring the database up to date, as Render's pre-deploy step does: migrations, then the
// diagnosis codes. Preview deploys only build, so a branch can never change the live database.
import { spawnSync } from "node:child_process";

function run(command) {
  console.log(`> ${command}`);
  const { status } = spawnSync(command, { stdio: "inherit", shell: true });
  if (status !== 0) process.exit(status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Add a hosted Postgres database to the Vercel project first (docs/deploy.md).");
    process.exit(1);
  }
  run("npm run db:migrate");
  run("npm run db:seed");
}
run("npx next build");
