import { AppShell } from "@/components/app-shell";
import { requireClinician } from "@/lib/auth";
import { practiceLogoUrlFor } from "@/lib/practice";

/** Clinician app. Admins are sent to /admin by requireClinician(). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { id, name, practiceName, updatedAt } = await requireClinician();
  const logoUrl = await practiceLogoUrlFor(id, updatedAt);

  return (
    <AppShell
      app="clinician"
      user={{ title: name, subtitle: practiceName, markName: practiceName, logoUrl }}
    >
      {children}
    </AppShell>
  );
}
