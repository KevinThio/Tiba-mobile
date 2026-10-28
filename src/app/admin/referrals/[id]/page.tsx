import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MessageComposer, MessageThread, ThreadUpkeep } from "@/components/portal-messages";
import { requireAdmin } from "@/lib/auth";
import { portalAccount, portalConversation } from "@/lib/portal";
import { TurnOffButton } from "../../messages/[id]/turn-off-button";
import { markReferralRead, replyToReferrer, turnOffReferralAccount } from "../actions";

/** One referral source's conversation with the practice (with their documents), and the admin's reply box. */
export default async function AdminReferralConversationPage({ params }: PageProps<"/admin/referrals/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const account = await portalAccount(admin.practiceId, id, "referrer");
  if (!account || account.status === "pending") notFound();
  const messages = await portalConversation(admin.practiceId, id);
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
