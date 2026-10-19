import { eq, isNotNull } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { practiceLogoUrl } from "@/lib/practice-logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { id, name, practiceName, email, updatedAt } = await requireClinician();
  // Only ask whether a logo exists; the image itself is fetched from /api/practice-logo.
  const [row] = await db
    .select({ hasLogo: isNotNull(clinicians.practiceLogo) })
    .from(clinicians)
    .where(eq(clinicians.id, id));
  const logoUrl = row?.hasLogo ? practiceLogoUrl(updatedAt) : null;

  return <AppShell clinician={{ name, practiceName, email, logoUrl }}>{children}</AppShell>;
}
