import { PageHeader } from "@/components/page-header";
import { practiceClinicians, practiceInvoices } from "@/lib/admin-billing";
import { requireAdmin } from "@/lib/auth";
import { practiceBilling } from "@/lib/practice";
import { InvoicesList } from "./invoices-list";

/**
 * Admin Invoices (spec v2 sections 5 and 5b): every invoice the practice's clinicians have
 * sent, in Unpaid, Paid and Issues tabs with a clinician filter. New ones carry a badge.
 */
export default async function AdminInvoicesPage() {
  const admin = await requireAdmin();
  const [rows, team, billing] = await Promise.all([
    practiceInvoices(admin.practiceId),
    practiceClinicians(admin.practiceId),
    practiceBilling(admin.practiceId),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader overline="Sent by your clinicians" title="Invoices" />
      <InvoicesList
        country={billing.country}
        clinicians={team}
        invoices={rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          seen: Boolean(r.seenAt),
          seenAt: undefined,
        }))}
      />
    </div>
  );
}
