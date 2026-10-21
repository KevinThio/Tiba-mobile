import { AppShell } from "@/components/app-shell";
import { requireClinician } from "@/lib/auth";
import { notesToDoCounts } from "@/lib/notes";
import { unreadNotificationCount } from "@/lib/notifications";
import { practiceLogoUrlFor } from "@/lib/practice";

/** Clinician app. Admins are sent to /admin by requireClinician(). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { id, name, practiceName, practiceId } = await requireClinician();
  const [logoUrl, toDo, unread] = await Promise.all([
    practiceLogoUrlFor(practiceId),
    notesToDoCounts(id),
    unreadNotificationCount(id),
  ]);

  return (
    <AppShell
      app="clinician"
      user={{ title: name, subtitle: practiceName, markName: practiceName, logoUrl }}
      badges={{ "/notes": toDo.needNote + toDo.drafts, "/notifications": unread }}
    >
      {children}
    </AppShell>
  );
}
