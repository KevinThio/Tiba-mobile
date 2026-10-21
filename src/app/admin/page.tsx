import { ChevronRight, CircleAlert, FileSignature, Landmark, LayoutDashboard, ReceiptText, Star, UserPlus, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { invoiceCounts, OVERDUE_DAYS, unbilledOverdue } from "@/lib/admin-billing";
import { requireAdmin } from "@/lib/auth";
import { unreadOfTypes } from "@/lib/notifications";
import { newReviewCount, pendingClinicianCount, possibleDuplicates } from "@/lib/practice";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type Attention = {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  badge?: { label: string; variant: "warning" | "info" };
};

export default async function AdminOverviewPage() {
  const { id, name, practiceName, practiceId } = await requireAdmin();
  const [waiting, newReviews, duplicates, unbilled, invoiceTotals] = await Promise.all([
    pendingClinicianCount(practiceId),
    newReviewCount(practiceId),
    possibleDuplicates(practiceId),
    unbilledOverdue(practiceId),
    invoiceCounts(practiceId),
  ]);
  const contractNews = await unreadOfTypes(id, ["contract_message", "contract_signed"]);

  const items: Attention[] = [];
  if (waiting > 0) {
    items.push({
      href: "/admin/clinicians",
      icon: UserPlus,
      title: `${waiting === 1 ? "1 clinician is" : `${waiting} clinicians are`} waiting to be verified`,
      detail: "They signed up with your practice name and can't see patients until you activate them.",
      badge: { label: "Verify", variant: "warning" },
    });
  }
  if (unbilled.count > 0) {
    items.push({
      href: "/admin/billing",
      icon: Landmark,
      title: `${unbilled.count === 1 ? "1 note" : `${unbilled.count} notes`} unbilled ${OVERDUE_DAYS}+ days`,
      detail: unbilled.oldest ? `Oldest signed ${DATE.format(unbilled.oldest)}.` : "Bill them to insurance.",
      badge: { label: "Overdue", variant: "warning" },
    });
  }
  if (invoiceTotals.unseen > 0) {
    items.push({
      href: "/admin/invoices",
      icon: ReceiptText,
      title: `${invoiceTotals.unseen === 1 ? "1 new invoice" : `${invoiceTotals.unseen} new invoices`} from clinicians`,
      detail: "Mark paid, or flag an issue.",
      badge: { label: "New", variant: "info" },
    });
  }
  if (invoiceTotals.issues > 0) {
    items.push({
      href: "/admin/invoices",
      icon: CircleAlert,
      title: `${invoiceTotals.issues === 1 ? "1 invoice has" : `${invoiceTotals.issues} invoices have`} an issue`,
      detail: "Waiting for the clinician to fix.",
    });
  }
  for (const c of contractNews) {
    items.push({
      href: c.href,
      icon: FileSignature,
      title: c.title,
      detail: c.type === "contract_signed" ? "Check it under Contracts." : "Reply, or update the contract and send it again.",
      badge: { label: c.type === "contract_signed" ? "Signed" : "Reply", variant: "info" },
    });
  }
  for (const d of duplicates) {
    items.push({
      href: `/admin/patients/${d.id}/duplicate`,
      icon: UsersRound,
      title: `Check possible duplicate: ${d.name}`,
      detail: "A clinician added a patient with the same name and date of birth as another record.",
      badge: { label: "Confirm", variant: "warning" },
    });
  }
  if (newReviews > 0) {
    items.push({
      href: "/admin/reviews",
      icon: Star,
      title: `${newReviews === 1 ? "1 new patient review" : `${newReviews} new patient reviews`}`,
      detail: "Only you can read them.",
      badge: { label: "New", variant: "info" },
    });
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline={`Admin · ${name}`} title={practiceName} />

      <section aria-labelledby="attention-heading" className="grid gap-3">
        <h2 id="attention-heading" className="text-h2">
          Needs your attention
        </h2>
        {items.length > 0 ? (
          <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
            {items.map(({ href, icon: Icon, title, detail, badge }) => (
              <li key={href} className="border-b border-border-subtle last:border-b-0">
                <Link
                  href={href}
                  className="flex items-center gap-4 px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-small text-muted-foreground">{detail}</span>
                  </span>
                  {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
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
