import { desc, eq } from "drizzle-orm";
import { Star } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { clinicians, reviews } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { MarkReviewsSeen } from "./mark-seen";
import { ReviewLink } from "./review-link";
import { ReviewVisibility } from "./review-visibility";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Every review patients sent, newest first. Admin only: clinicians never see reviews.
 * Admins can hide a review (it leaves the list and the average) but never delete it.
 */
export default async function AdminReviewsPage() {
  const admin = await requireAdmin();
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      text: reviews.text,
      name: reviews.name,
      createdAt: reviews.createdAt,
      seenAt: reviews.seenAt,
      hiddenAt: reviews.hiddenAt,
      clinicianName: clinicians.name,
    })
    .from(reviews)
    .leftJoin(clinicians, eq(clinicians.id, reviews.clinicianId))
    .where(eq(reviews.practiceId, admin.practiceId))
    .orderBy(desc(reviews.createdAt));

  const shown = rows.filter((r) => !r.hiddenAt);
  const hidden = rows.filter((r) => r.hiddenAt);
  const average = shown.length ? shown.reduce((sum, r) => sum + r.rating, 0) / shown.length : 0;

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline="From your patients" title="Patient reviews" />

      {shown.length > 0 && (
        <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
          <p className="font-heading text-display text-primary">{average.toFixed(1)}</p>
          <div className="grid gap-1">
            <Stars rating={Math.round(average)} />
            <p className="text-small text-muted-foreground">
              Average from {shown.length} {shown.length === 1 ? "review" : "reviews"}. Only admins can see these. Patients send
              them from the sign-in page.
            </p>
          </div>
        </section>
      )}

      {shown.length === 0 ? (
        <EmptyState icon={Star} title={hidden.length ? "No reviews showing" : "No reviews yet"}>
          Patients can leave one from the Tiba sign-in page, or from your practice&apos;s review link below.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
          {shown.map((r) => (
            <ReviewRow key={r.id} review={r} />
          ))}
        </ul>
      )}

      {hidden.length > 0 && (
        <details className="group rounded-lg border border-border-subtle bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring">
            Hidden reviews ({hidden.length})
            <span className="text-small font-normal text-muted-foreground group-open:hidden">Show</span>
          </summary>
          <p className="border-t border-border-subtle px-5 pt-4 text-small text-muted-foreground">
            Hidden reviews don&apos;t count towards your average. Reviews can&apos;t be deleted.
          </p>
          <ul className="grid grid-cols-1">
            {hidden.map((r) => (
              <ReviewRow key={r.id} review={r} />
            ))}
          </ul>
        </details>
      )}

      <ReviewLink practiceId={admin.practiceId} />
      {rows.some((r) => !r.seenAt) && <MarkReviewsSeen />}
    </div>
  );
}

function ReviewRow({
  review: r,
}: {
  review: {
    id: string;
    rating: number;
    text: string;
    name: string | null;
    createdAt: Date;
    seenAt: Date | null;
    hiddenAt: Date | null;
    clinicianName: string | null;
  };
}) {
  return (
    <li className="grid gap-2 border-b border-border-subtle px-5 py-5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <Stars rating={r.rating} />
        {!r.seenAt && !r.hiddenAt && <Badge variant="info">New</Badge>}
        {r.hiddenAt && <Badge variant="neutral">Hidden {dateFormat.format(r.hiddenAt)}</Badge>}
        <span className="ml-auto">
          <ReviewVisibility reviewId={r.id} hidden={Boolean(r.hiddenAt)} />
        </span>
      </div>
      <p className={cn("whitespace-pre-line", r.hiddenAt && "text-muted-foreground")}>{r.text}</p>
      <p className="text-small text-muted-foreground">
        {[r.name || "Anonymous", r.clinicianName ?? "Clinician not named", dateFormat.format(r.createdAt)].join(" · ")}
      </p>
    </li>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-5", n <= rating ? "fill-primary text-primary" : "text-border-strong")} aria-hidden />
      ))}
    </span>
  );
}
