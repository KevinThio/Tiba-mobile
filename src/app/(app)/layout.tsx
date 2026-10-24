import { AppShell } from "@/components/app-shell";
import { AssistantWidget } from "@/components/assistant-widget";
import { requireClinician } from "@/lib/auth";
import { contractCounts } from "@/lib/contract-data";
import { notesToDoCounts } from "@/lib/notes";
import { unreadNotificationCount } from "@/lib/notifications";
import { practiceLogoUrlFor } from "@/lib/practice";

/** Clinician app. Admins are sent to /admin by requireClinician(). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { id, name, practiceName, practiceId } = await requireClinician();
  const [logoUrl, toDo, unread, contracts] = await Promise.all([
    practiceLogoUrlFor(practiceId),
    notesToDoCounts(id),
    unreadNotificationCount(id),
    contractCounts({ clinicianId: id }),
  ]);

  return (
    <AppShell
      app="clinician"
      user={{ title: name, subtitle: practiceName, markName: practiceName, logoUrl }}
      badges={{ "/notes": toDo.needNote + toDo.drafts, "/notifications": unread, "/contracts": contracts.waiting }}
    >
      {children}
      <AssistantWidget audience="clinician" withTabBar />
    </AppShell>
  );
}
