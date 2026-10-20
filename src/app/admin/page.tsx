import { ChevronRight, LayoutDashboard, UserPlus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { pendingClinicianCount } from "@/lib/practice";

export default async function AdminOverviewPage() {
  const { name, practiceName, practiceId } = await requireAdmin();
  const waiting = await pendingClinicianCount(practiceId);

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline={`Admin · ${name}`} title={practiceName} />

      <section aria-labelledby="attention-heading" className="grid gap-3">
        <h2 id="attention-heading" className="text-h2">
          Needs your attention
        </h2>
        {waiting > 0 ? (
          <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
            <li>
              <Link
                href="/admin/clinicians"
                className="flex items-center gap-4 rounded-lg px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <UserPlus className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {waiting === 1 ? "1 clinician is" : `${waiting} clinicians are`} waiting to be verified
                  </span>
                  <span className="block text-small text-muted-foreground">
                    They signed up with your practice name and can&apos;t see patients until you activate them.
                  </span>
                </span>
                <Badge variant="warning">Verify</Badge>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          </ul>
        ) : (
          <p className="rounded-lg border border-border-subtle bg-card px-5 py-4 text-muted-foreground shadow-sm">
            Nothing needs you right now.
          </p>
        )}
      </section>

      <EmptyState icon={LayoutDashboard} title="More of your overview is coming soon">
        Notes waiting to be billed, agreements to sign, new invoices, possible duplicates and today&apos;s visits across
        the practice will show here.
      </EmptyState>
    </div>
  );
}
