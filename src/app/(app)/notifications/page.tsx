import { Bell } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireClinician } from "@/lib/auth";

export default async function NotificationsPage() {
  await requireClinician();
  return (
    <div className="grid gap-8">
      <PageHeader overline="For you" title="Notifications" back={{ href: "/settings", label: "Account" }} />
      <EmptyState icon={Bell} title="You're all caught up">
        New contracts to sign, replies from your admin and invoice questions will show here.
      </EmptyState>
    </div>
  );
}
