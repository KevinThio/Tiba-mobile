import { AppShell } from "@/components/app-shell";
import { AssistantWidget } from "@/components/assistant-widget";
import { clinicianSettings } from "@/lib/account";
import { requireClinician } from "@/lib/auth";
import { contractCounts } from "@/lib/contract-data";
import { notesToDoCounts } from "@/lib/notes";
import { unreadNotificationCount } from "@/lib/notifications";
import { openOfferCount } from "@/lib/patient-offers";
import { practiceLogoUrlFor } from "@/lib/practice";

/** Clinician app. Admins are sent to /admin by requireClinician(). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { id, name, practiceName, practiceId } = await requireClinician();
  const { discipline } = await clinicianSettings(id);
  const [logoUrl, toDo, unread, contracts, offers] = await Promise.all([
    practiceLogoUrlFor(practiceId),
    notesToDoCounts(id),
    unreadNotificationCount(id),
    contractCounts({ clinicianId: id }),
    openOfferCount(practiceId, discipline),
  ]);

  return (
    <AppShell
      app="clinician"
      user={{ title: name, subtitle: practiceName, markName: practiceName, logoUrl }}
      badges={{ "/notes": toDo.needNote + toDo.drafts, "/notifications": unread, "/contracts": contracts.waiting, "/new-patients": offers }}
    >
      {children}
      <AssistantWidget audience="clinician" withTabBar />
    </AppShell>
  );
}
