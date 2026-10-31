import { AppShell } from "@/components/app-shell";
import { AssistantWidget } from "@/components/assistant-widget";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/components/nav-items";
import { invoiceCounts, unbilledOverdue } from "@/lib/admin-billing";
import { unreadNotificationCount, unreadOfTypes } from "@/lib/notifications";
import { portalCounts } from "@/lib/portal";
import { waitingOffers } from "@/lib/patient-offers";
import { newReviewCount, pendingClinicianCount, possibleDuplicates, practiceLogoUrlFor } from "@/lib/practice";

/** Admin app (spec v2 section 5). Clinicians are sent back to their app by requireAdmin(). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { id, name, practiceName, practiceId } = await requireAdmin();
  const [logoUrl, pending, newReviews, duplicates, unread, invoiceTotals, unbilled, contractNews, portal, referral, clockFlags, offered] = await Promise.all([
    practiceLogoUrlFor(practiceId),
    pendingClinicianCount(practiceId),
    newReviewCount(practiceId),
    possibleDuplicates(practiceId),
    unreadNotificationCount(id),
    invoiceCounts(practiceId),
    unbilledOverdue(practiceId),
    unreadOfTypes(id, ["contract_message", "contract_signed"]),
    portalCounts(practiceId),
    portalCounts(practiceId, "referrer"),
    unreadOfTypes(id, ["clock_flag"]),
    waitingOffers(practiceId),
  ]);

  return (
    <AppShell
      app="admin"
      practiceBrand={{ name: practiceName, logoUrl, caption: "Admin account" }}
      user={{ title: name, subtitle: "Administrator", markName: name, logoUrl: null }}
      badges={{
        [ADMIN_SECTIONS.clinicians.href]: pending,
        [ADMIN_SECTIONS.reviews.href]: newReviews,
        [ADMIN_SECTIONS.patients.href]: duplicates.length + offered.filter((o) => o.accepted > 0).length,
        [ADMIN_SECTIONS.notifications.href]: unread,
        [ADMIN_SECTIONS.invoices.href]: invoiceTotals.unseen,
        [ADMIN_SECTIONS.billing.href]: unbilled.count,
        [ADMIN_SECTIONS.contracts.href]: contractNews.length,
        [ADMIN_SECTIONS.messages.href]: portal.requests + portal.unread,
        [ADMIN_SECTIONS.visits.href]: clockFlags.length,
        [ADMIN_SECTIONS.referrals.href]: referral.requests + referral.unread + referral.referrals,
      }}
    >
      {children}
      <AssistantWidget audience="admin" withTabBar />
    </AppShell>
  );
}
