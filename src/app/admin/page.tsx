import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";

export default async function AdminOverviewPage() {
  const { name, practiceName } = await requireAdmin();
  return (
    <div className="grid gap-8">
      <PageHeader overline={`Admin · ${name}`} title={practiceName} />
      <EmptyState icon={LayoutDashboard} title="Your overview is coming soon">
        Notes waiting to be billed, agreements to sign, new invoices, possible duplicates and today&apos;s visits across
        the practice will show here.
      </EmptyState>
    </div>
  );
}
