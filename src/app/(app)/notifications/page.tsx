import { NotificationsList } from "@/components/notifications-list";
import { PageHeader } from "@/components/page-header";
import { requireClinician } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";

/** Clinician Notifications (spec v2): contracts to sign, admin replies and invoice issues. */
export default async function NotificationsPage() {
  const clinician = await requireClinician();
  const rows = await listNotifications(clinician.id);
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader overline="For you" title="Notifications" back={{ href: "/settings", label: "Account" }} />
      <NotificationsList
        rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), read: Boolean(r.readAt) }))}
        emptyText="New contracts to sign, replies from your admin and questions about your invoices will show here."
      />
    </div>
  );
}
