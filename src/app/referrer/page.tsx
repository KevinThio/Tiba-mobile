import { FileUp, Hourglass, Plus, UserX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { MessageComposer, MessageThread, ThreadUpkeep } from "@/components/portal-messages";
import { ReferralCard, ReferralFilterTabs } from "@/components/referral-list";
import { Button } from "@/components/ui/button";
import { requireReferrer } from "@/lib/auth";
import { ATTACHMENT_MAX_BYTES, ATTACHMENTS_MAX, portalConversation } from "@/lib/portal";
import { isReferralFilter, REFERRAL_FILTERS } from "@/lib/referral-status";
import { listReferrals, referralCounts } from "@/lib/referrals";
import { markReferralPortalRead, sendReferralMessage } from "./actions";

/**
 * The referral source's portal: waiting for the practice to confirm them, turned off, or Make a
 * referral, their referrals (all, waiting, accepted or declined) and their messages with the practice.
 */
export default async function ReferrerPage({ searchParams }: PageProps<"/referrer">) {
  const referrer = await requireReferrer();
  const practice = referrer.practiceName;

  if (referrer.status !== "active") {
    const off = referrer.status === "deactivated";
    const Icon = off ? UserX : Hourglass;
    return (
      <section className="mx-auto grid max-w-form gap-4 py-10 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-7" aria-hidden />
        </span>
        <h1 className="text-h2">{off ? "Your referral portal account is turned off" : `Waiting for ${practice}`}</h1>
        <p className="text-muted-foreground">
          {off
            ? `${practice} couldn't confirm your account, or turned it off. If you send them referrals, please contact them directly.`
            : `${practice} checks who you are before you can send referrals. We'll email you at ${referrer.email} once they confirm you, and then you can send them referrals, messages and documents.`}
        </p>
      </section>
    );
  }

  const { show: raw } = await searchParams;
  const show = isReferralFilter(raw) ? raw : "all";
  const [messages, referrals, counts] = await Promise.all([
    portalConversation(referrer.practiceId, referrer.id),
    listReferrals(referrer.practiceId, { referrerId: referrer.id, status: show === "all" ? undefined : show }),
    referralCounts(referrer.practiceId, referrer.id),
  ]);
  const hasUnread = messages.some((m) => !m.fromPatient && !m.readAt);
  const filterLabel = REFERRAL_FILTERS.find((f) => f.key === show)!.label.toLowerCase();

  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <div className="grid gap-1">
          <p className="text-overline text-muted-foreground uppercase">Hello, {referrer.name.split(" ")[0]}</p>
          <h1 className="text-h1">Referrals</h1>
          <p className="text-muted-foreground">
            Send {practice} a referral with the patient&apos;s details and documents. You&apos;ll see here when they accept or
            decline it, and we&apos;ll email you.
          </p>
        </div>
        <Button size="lg" className="w-full sm:w-fit" nativeButton={false} render={<Link href="/referrer/new" />}>
          <Plus aria-hidden />
          Make a referral
        </Button>
      </header>

      <section className="grid gap-3" aria-labelledby="referrals-heading">
        <h2 id="referrals-heading" className="text-h2">
          Your referrals
        </h2>
        <ReferralFilterTabs base="/referrer" current={show} counts={counts} />
        {referrals.length ? (
          <ul className="grid grid-cols-1 gap-3">
            {referrals.map((r) => (
              <ReferralCard key={r.id} referral={r} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={FileUp} title={show === "all" ? "No referrals yet" : `No ${filterLabel} referrals`}>
            {show === "all" ? `Choose Make a referral to send ${practice} your first one.` : "Referrals show here once they have this status."}
          </EmptyState>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="messages-heading">
        <h2 id="messages-heading" className="text-h2">
          Messages
        </h2>
        <p className="rounded-md bg-warning px-4 py-3 text-small text-warning-foreground">
          <span className="font-semibold">Not for urgent care.</span> For anything urgent, call {practice} directly.
        </p>
        <div className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <MessageThread
            messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
            viewer="portal"
            practiceName={practice}
            empty={`No messages yet. Your referrals and ${practice}'s replies show here too.`}
          />
          <MessageComposer
            send={sendReferralMessage}
            label={`Message ${practice}`}
            placeholder="A question, or more about a referral"
            attachments={{ url: "/api/referral/attachments", max: ATTACHMENTS_MAX, maxBytes: ATTACHMENT_MAX_BYTES }}
          />
        </div>
      </section>
      <ThreadUpkeep markRead={markReferralPortalRead} hasUnread={hasUnread} />
    </div>
  );
}
