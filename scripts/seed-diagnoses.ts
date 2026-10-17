// Loads the fixed diagnosis code list into diagnosis_codes. Safe to re-run.
// Usage: npm run db:seed [-- path/to/codes.csv]
// The CSV needs a header row "code,description". Defaults to the small sample
// list; replace it with the full licensed list for your market before launch.
import "./load-env";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db, _dbGlobals } from "../src/db";
import { diagnosisCodes } from "../src/db/schema";

function parseCsv(text: string): { code: string; description: string }[] {
  const rows: { code: string; description: string }[] = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const match = line.match(/^([^,]+),"?(.*?)"?$/);
    if (!match) throw new Error(`Could not read line: ${line}`);
    rows.push({ code: match[1].trim(), description: match[2].replace(/""/g, '"') });
  }
  return rows;
}

async function main() {
  const file = process.argv[2] ?? "data/diagnosis-codes.sample.csv";
  const rows = parseCsv(readFileSync(file, "utf8"));
  for (let i = 0; i < rows.length; i += 1000) {
    await db
      .insert(diagnosisCodes)
      .values(rows.slice(i, i + 1000))
      .onConflictDoUpdate({
        target: diagnosisCodes.code,
        set: { description: sql`excluded.description` },
      });
  }
  await _dbGlobals.tibaPglite?.close();
  console.log(`Loaded ${rows.length} diagnosis codes from ${file}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
