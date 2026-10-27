import { ChevronRight, CircleAlert, FilePen, FileSignature, Landmark, MessagesSquare, ReceiptText, Star, UserPlus, UserRoundCheck, UserX, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { invoiceCounts, OVERDUE_DAYS, unbilledOverdue } from "@/lib/admin-billing";
import { requireAdmin } from "@/lib/auth";
import { unreadOfTypes } from "@/lib/notifications";
import { agreementsToSign, deactivatedClinicians, oldestNewReview, visitsAroundToday } from "@/lib/overview";
import { portalCounts } from "@/lib/portal";
import { newReviewCount, pendingClinicianCount, possibleDuplicates } from "@/lib/practice";
import { TodayVisits } from "./today-visits";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DAY_MS = 86_400_000;
const daysAgo = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY_MS));
const ago = (days: number) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

/** "In the last two weeks" for the new-reviews row, from when the oldest unread one arrived. */
function reviewSpan(oldest: Date | null) {
  if (!oldest) return "Only you can read them.";
  const days = daysAgo(oldest);
  if (days === 0) return "Today. Only you can read them.";
  if (days < 7) return `In the last ${days + 1} days. Only you can read them.`;
  const weeks = Math.ceil((days + 1) / 7);
  return `In the last ${weeks === 2 ? "two" : weeks} weeks. Only you can read them.`;
}

type Attention = {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  badge?: { label: string; variant: "warning" | "info" | "neutral" };
};

export default async function AdminOverviewPage() {
  const { id, name, practiceName, practiceId } = await requireAdmin();
  const [waiting, newReviews, duplicates, unbilled, invoiceTotals, toSign, deactivated, firstNewReview, around] = await Promise.all([
    pendingClinicianCount(practiceId),
    newReviewCount(practiceId),
    possibleDuplicates(practiceId),
    unbilledOverdue(practiceId),
    invoiceCounts(practiceId),
    agreementsToSign(practiceId),
    deactivatedClinicians(practiceId),
    oldestNewReview(practiceId),
    visitsAroundToday(practiceId),
  ]);
  const [contractNews, portal] = await Promise.all([unreadOfTypes(id, ["contract_message", "contract_signed"]), portalCounts(practiceId)]);

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
  if (portal.requests > 0) {
    items.push({
      href: "/admin/messages",
      icon: UserRoundCheck,
      title: `${portal.requests === 1 ? "1 patient is" : `${portal.requests} patients are`} asking to join the patient portal`,
      detail: "Check it's really your patient before they can message you.",
      badge: { label: "Confirm", variant: "warning" },
    });
  }
  if (portal.unread > 0) {
    items.push({
      href: "/admin/messages",
      icon: MessagesSquare,
      title: `${portal.unread === 1 ? "1 new message" : `${portal.unread} new messages`} from patients`,
      detail: "Patients wrote to you from the patient portal.",
      badge: { label: "New", variant: "info" },
    });
  }
  if (unbilled.count > 0) {
    items.push({
      href: "/admin/billing",
      icon: Landmark,
      title: `${unbilled.count === 1 ? "1 note" : `${unbilled.count} notes`} unbilled ${OVERDUE_DAYS}+ days`,
      detail: unbilled.oldest ? `Oldest signed ${DATE.format(unbilled.oldest)} · ${ago(daysAgo(unbilled.oldest))}` : "Bill them to insurance.",
      badge: { label: "Overdue", variant: "warning" },
    });
  }
  for (const a of toSign) {
    items.push({
      href: `/admin/patients/${a.patientId}/agreement`,
      icon: FilePen,
      title: `Sign ${a.name.split(" ")[0]}'s service agreement`,
      detail: a.signedAt ? `The client signed ${ago(daysAgo(a.signedAt))}. It needs the agency witness's signature.` : "It needs the agency witness's signature.",
      badge: { label: "Sign", variant: "warning" },
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
  for (const c of deactivated) {
    items.push({
      href: `/admin/clinicians/${c.id}`,
      icon: UserX,
      title: `${c.name}'s account is deactivated`,
      detail: "They can't sign in. Their notes are kept.",
      badge: { label: "Deactivated", variant: "neutral" },
    });
  }
  if (newReviews > 0) {
    items.push({
      href: "/admin/reviews",
      icon: Star,
      title: `${newReviews === 1 ? "1 new patient review" : `${newReviews} new patient reviews`}`,
      detail: reviewSpan(firstNewReview),
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
              <li key={title} className="border-b border-border-subtle last:border-b-0">
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

      <section aria-labelledby="today-heading" className="grid gap-3">
        <h2 id="today-heading" className="text-h2">
          Today across the practice
        </h2>
        <TodayVisits visits={around.map((v) => ({ ...v, missed: Boolean(v.missed), startsAt: v.startsAt.toISOString() }))} />
      </section>
    </div>
  );
}
