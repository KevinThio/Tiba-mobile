import { NotificationsList } from "@/components/notifications-list";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";

/** Admin Notifications (spec v2 section 5b): new invoices, possible duplicates and new reviews. */
export default async function AdminNotificationsPage() {
  const admin = await requireAdmin();
  const rows = await listNotifications(admin.id);
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader overline="For you" title="Notifications" />
      <NotificationsList
        rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), read: Boolean(r.readAt) }))}
        emptyText="New invoices from your clinicians, possible duplicate patients and new reviews will show here."
      />
    </div>
  );
}
