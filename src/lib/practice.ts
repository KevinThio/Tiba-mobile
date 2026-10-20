import "server-only";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { practiceLogoUrl } from "@/lib/practice-logo";

/** The account's practice logo URL, or null when it has none. Only checks that a logo exists; the image comes from /api/practice-logo. */
export async function practiceLogoUrlFor(accountId: string, updatedAt: Date | string) {
  const [row] = await db
    .select({ hasLogo: isNotNull(clinicians.practiceLogo) })
    .from(clinicians)
    .where(eq(clinicians.id, accountId));
  return row?.hasLogo ? practiceLogoUrl(updatedAt) : null;
}
