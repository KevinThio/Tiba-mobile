import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/components/nav-items";
import { invoiceCounts, unbilledOverdue } from "@/lib/admin-billing";
import { unreadNotificationCount } from "@/lib/notifications";
import { newReviewCount, pendingClinicianCount, possibleDuplicates, practiceLogoUrlFor } from "@/lib/practice";

/** Admin app (spec v2 section 5). Clinicians are sent back to their app by requireAdmin(). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { id, name, practiceName, practiceId } = await requireAdmin();
  const [logoUrl, pending, newReviews, duplicates, unread, invoiceTotals, unbilled] = await Promise.all([
    practiceLogoUrlFor(practiceId),
    pendingClinicianCount(practiceId),
    newReviewCount(practiceId),
    possibleDuplicates(practiceId),
    unreadNotificationCount(id),
    invoiceCounts(practiceId),
    unbilledOverdue(practiceId),
  ]);

  return (
    <AppShell
      app="admin"
      practiceBrand={{ name: practiceName, logoUrl, caption: "Admin account" }}
      user={{ title: name, subtitle: "Administrator", markName: name, logoUrl: null }}
      badges={{
        [ADMIN_SECTIONS.clinicians.href]: pending,
        [ADMIN_SECTIONS.reviews.href]: newReviews,
        [ADMIN_SECTIONS.patients.href]: duplicates.length,
        [ADMIN_SECTIONS.notifications.href]: unread,
        [ADMIN_SECTIONS.invoices.href]: invoiceTotals.unseen,
        [ADMIN_SECTIONS.billing.href]: unbilled.count,
      }}
    >
      {children}
    </AppShell>
  );
}
