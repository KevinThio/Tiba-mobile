import { ChartColumn, ChevronRight, FileUp, Inbox } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ADMIN_SECTIONS } from "@/components/nav-items";
import { PageHeader } from "@/components/page-header";
import { ReferralCard, ReferralFilterTabs } from "@/components/referral-list";
import { ReferralPatientLink } from "./referral-patient-link";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { portalConversations, referralRequests } from "@/lib/portal";
import { isReferralFilter, REFERRAL_FILTERS } from "@/lib/referral-status";
import { listReferrals, referralCounts } from "@/lib/referrals";
import { ReferralDecision } from "./referral-decision";
import { ReferralRequestCard } from "./request-card";

const S = ADMIN_SECTIONS.referrals;

/**
 * Referral sources (referral portal): hospitals, doctors and agencies asking to join, for the
 * admin to confirm; their referrals (waiting first) to accept or decline; then every
 * conversation with the newest first and unread counts.
 */
export default async function AdminReferralsPage({ searchParams }: PageProps<"/admin/referrals">) {
  const admin = await requireAdmin();
  const { show: raw } = await searchParams;
  const show = isReferralFilter(raw) ? raw : "pending";
  const [requests, conversations, referrals, counts] = await Promise.all([
    referralRequests(admin.practiceId),
    portalConversations(admin.practiceId, "referrer"),
    listReferrals(admin.practiceId, { status: show === "all" ? undefined : show }),
    referralCounts(admin.practiceId),
  ]);
  const filterLabel = REFERRAL_FILTERS.find((f) => f.key === show)!.label.toLowerCase();

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        overline={S.overline}
        title={S.label}
        description={S.description}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/performance#referrals" />}>
            <ChartColumn aria-hidden />
            Referral analysis
          </Button>
        }
      />

      {requests.length > 0 && (
        <section className="grid gap-3" aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="flex items-center gap-2 text-h3">
            Asking to join <Badge variant="warning">{requests.length}</Badge>
          </h2>
          <p className="text-small text-muted-foreground">
            Check you know each person and organisation before you confirm. Until then they can&apos;t send messages or documents.
          </p>
          <ul className="grid gap-3">
            {requests.map((r) => (
              <ReferralRequestCard key={r.id} request={{ ...r, createdAt: r.createdAt.toISOString() }} />
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3" aria-labelledby="referrals-heading">
        <h2 id="referrals-heading" className="flex items-center gap-2 text-h3">
          Referrals {counts.pending > 0 && <Badge variant="warning">{counts.pending} waiting</Badge>}
        </h2>
        <ReferralFilterTabs base="/admin/referrals" current={show} counts={counts} defaultKey="pending" />
        {referrals.length ? (
          <ul className="grid grid-cols-1 gap-3">
            {referrals.map((r) => (
              <ReferralCard
                key={r.id}
                referral={r}
                showSource
                actions={
                  r.status === "pending" ? (
                    <ReferralDecision referralId={r.id} patientName={r.patientName} />
                  ) : r.status === "accepted" ? (
                    <ReferralPatientLink referralId={r.id} patientId={r.patientId} />
                  ) : null
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyState icon={Inbox} title={show === "pending" ? "No referrals waiting" : `No ${filterLabel} referrals`}>
            {show === "pending" ? "New referrals from your referral sources show here for you to accept or decline." : "Referrals show here once they have this status."}
          </EmptyState>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="conversations-heading">
        <h2 id="conversations-heading" className="text-h3">
          Conversations
        </h2>
        {conversations.length ? (
          <ul className="grid overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
            {conversations.map((c) => (
              <li key={c.id} className="border-b border-border-subtle last:border-b-0">
                <Link
                  href={`/admin/referrals/${c.id}`}
                  className="flex items-center gap-3 px-5 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{c.name}</span>
                      {c.organisation && <span className="truncate text-small text-muted-foreground">{c.organisation}</span>}
                      {c.status === "deactivated" && <Badge variant="neutral">Turned off</Badge>}
                      {c.unread > 0 && <Badge variant="accent">{c.unread} new</Badge>}
                    </span>
                    <span className="block truncate text-small text-muted-foreground">
                      {c.last ? `${c.last.fromPatient ? "" : "You: "}${c.last.body}` : "No messages yet"}
                    </span>
                  </span>
                  {c.last && (
                    <span className="hidden shrink-0 text-caption text-muted-foreground sm:block">
                      <RelativeDay iso={c.last.createdAt.toISOString()} />
                    </span>
                  )}
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileUp} title="No referral sources yet">
            Hospitals, doctors and agencies sign up from &quot;Are you a referral source?&quot; on Tiba&apos;s sign-in page,
            using your practice&apos;s exact name. Once you confirm them, their referrals and documents show here.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
