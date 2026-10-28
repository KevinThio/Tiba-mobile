import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MessageComposer, MessageThread, ThreadUpkeep } from "@/components/portal-messages";
import { ReferralCard } from "@/components/referral-list";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { portalAccount, portalConversation } from "@/lib/portal";
import { listReferrals } from "@/lib/referrals";
import { TurnOffButton } from "../../messages/[id]/turn-off-button";
import { markReferralRead, replyToReferrer, turnOffReferralAccount } from "../actions";
import { ReferralDecision } from "../referral-decision";

/** One referral source: their referrals (to accept or decline), the conversation with their documents, and the reply box. */
export default async function AdminReferralConversationPage({ params }: PageProps<"/admin/referrals/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const account = await portalAccount(admin.practiceId, id, "referrer");
  if (!account || account.status === "pending") notFound();
  const [messages, referrals] = await Promise.all([portalConversation(admin.practiceId, id), listReferrals(admin.practiceId, { referrerId: id })]);
  const waiting = referrals.filter((r) => r.status === "pending").length;
  const accepted = referrals.filter((r) => r.status === "accepted").length;
  const hasUnread = messages.some((m) => m.fromPatient && !m.readAt);
  const first = account.name.split(" ")[0];

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/admin/referrals", label: "Referral sources" }}
        overline={account.organisation ?? "Referral portal"}
        title={account.name}
        description={account.email}
        actions={account.status === "active" && <TurnOffButton accountId={account.id} name={account.name} turnOff={turnOffReferralAccount} />}
      />
      {account.status === "deactivated" && (
        <p className="rounded-md bg-neutral px-4 py-3 text-neutral-foreground">
          <span className="font-semibold">Referral portal access is turned off.</span> {account.name} can&apos;t send or read messages.
        </p>
      )}
      <section className="grid gap-3" aria-labelledby="source-referrals-heading">
        <h2 id="source-referrals-heading" className="flex flex-wrap items-center gap-2 text-h3">
          Referrals {waiting > 0 && <Badge variant="warning">{waiting} waiting</Badge>}
        </h2>
        {referrals.length ? (
          <>
            <p className="text-small text-muted-foreground">
              {referrals.length} sent · {accepted} accepted · {referrals.length - accepted - waiting} declined
            </p>
            <ul className="grid grid-cols-1 gap-3">
              {referrals.map((r) => (
                <ReferralCard key={r.id} referral={r} actions={r.status === "pending" && <ReferralDecision referralId={r.id} patientName={r.patientName} />} />
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-lg border border-border-subtle bg-card px-5 py-4 text-muted-foreground shadow-sm">{first} hasn&apos;t sent a referral yet.</p>
        )}
      </section>
      <h2 className="text-h3">Messages</h2>
      <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <MessageThread
          messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          viewer="practice"
          practiceName={admin.practiceName}
          empty={`No messages yet. You can write to ${first} first.`}
        />
        {account.status === "active" && (
          <MessageComposer send={replyToReferrer.bind(null, account.id)} label={`Reply to ${first}`} placeholder="Write your reply" />
        )}
      </section>
      <ThreadUpkeep markRead={markReferralRead.bind(null, account.id)} hasUnread={hasUnread} />
    </div>
  );
}
