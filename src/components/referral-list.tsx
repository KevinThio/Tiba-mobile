import { FileText } from "lucide-react";
import Link from "next/link";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { sizeText } from "@/lib/format";
import { REFERRAL_FILTERS, REFERRAL_STATUS, type ReferralFilter } from "@/lib/referral-status";
import type { Referral } from "@/lib/referrals";
import { cn } from "@/lib/utils";

const BORN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const born = (iso: string) => BORN.format(new Date(`${iso}T00:00:00Z`));

/**
 * All · Waiting · Accepted · Declined tabs with counts, as links (`?show=`), so the list is
 * server-rendered. `defaultKey` is the tab the bare `base` shows.
 */
export function ReferralFilterTabs({
  base,
  current,
  counts,
  defaultKey = "all",
}: {
  base: string;
  current: ReferralFilter;
  defaultKey?: ReferralFilter;
  counts: Record<"all" | "pending" | "accepted" | "declined", number>;
}) {
  return (
    <nav aria-label="Show referrals" className="-mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
      {REFERRAL_FILTERS.map((f) => (
        <Link
          key={f.key}
          href={f.key === defaultKey ? base : `${base}?show=${f.key}`}
          scroll={false}
          aria-current={f.key === current ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-[1.5px] px-4 text-small font-semibold transition-colors duration-120 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring",
            f.key === current ? "border-primary bg-secondary text-primary" : "border-input bg-card hover:bg-muted",
          )}
        >
          {f.label}
          <span className="text-muted-foreground">{counts[f.key]}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * One referral: the patient's name, date of birth and cover, the note, documents, when it was sent
 * and its status, with the practice's decision and note once decided. `showSource` adds who sent
 * it (the admin's view); `actions` holds the admin's Accept and Decline.
 */
export function ReferralCard({ referral: r, showSource = false, actions }: { referral: Referral; showSource?: boolean; actions?: React.ReactNode }) {
  const status = REFERRAL_STATUS[r.status];
  return (
    <li className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{r.patientName}</p>
          <p className="text-small text-muted-foreground">Born {born(r.birthDate)}</p>
        </div>
        <Badge variant={status.badge}>{status.label}</Badge>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-small sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Insurance:</dt>
          <dd className="min-w-0 break-words">{r.insurer}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Insurance ID:</dt>
          <dd className="min-w-0 break-words">{r.insuranceId ?? "None (self-pay)"}</dd>
        </div>
        {showSource && (
          <div className="flex gap-1.5 sm:col-span-2">
            <dt className="text-muted-foreground">From:</dt>
            <dd className="min-w-0 break-words">
              <Link href={`/admin/referrals/${r.referrerId}`} className="font-semibold underline-offset-2 hover:underline">
                {r.referrerName}
              </Link>
              {r.organisation && ` · ${r.organisation}`}
            </dd>
          </div>
        )}
      </dl>
      {r.note && <p className="rounded-sm bg-muted px-3 py-2 text-small break-words whitespace-pre-line">{r.note}</p>}
      {r.attachments.length > 0 && (
        <ul className="grid gap-1.5" aria-label="Documents">
          {r.attachments.map((f) => (
            <li key={f.id}>
              <a
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noopener"
                className="flex min-h-11 items-center gap-2 rounded-sm border border-border-subtle px-3 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
              >
                <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                <span className="shrink-0 text-caption text-muted-foreground">{sizeText(f.size)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-muted-foreground">
        Sent <RelativeDay iso={r.createdAt.toISOString()} withTime />
        {r.decidedAt && (
          <>
            {" "}
            · {status.label} <RelativeDay iso={r.decidedAt.toISOString()} withTime />
            {showSource && r.decidedByName && ` by ${r.decidedByName}`}
          </>
        )}
      </p>
      {r.decisionNote && (
        <p className={cn("rounded-sm px-3 py-2 text-small break-words whitespace-pre-line", r.status === "declined" ? "bg-danger text-danger-foreground" : "bg-success text-success-foreground")}>
          <span className="font-semibold">Note from the practice:</span> {r.decisionNote}
        </p>
      )}
      {actions}
    </li>
  );
}
