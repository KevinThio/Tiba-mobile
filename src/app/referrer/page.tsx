import { Hourglass, UserX } from "lucide-react";
import { MessageComposer, MessageThread, ThreadUpkeep } from "@/components/portal-messages";
import { requireReferrer } from "@/lib/auth";
import { ATTACHMENT_MAX_BYTES, ATTACHMENTS_MAX, portalConversation } from "@/lib/portal";
import { markReferralPortalRead, sendReferralMessage } from "./actions";

/**
 * The referral source's portal: waiting for the practice to confirm them, turned off, or their
 * messages with the practice and a box to write a new one with documents.
 */
export default async function ReferrerPage() {
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
            : `${practice} checks who you are before you can send referrals. We'll email you at ${referrer.email} once they confirm you, and then you can send them messages and documents.`}
        </p>
      </section>
    );
  }

  const messages = await portalConversation(referrer.practiceId, referrer.id);
  const hasUnread = messages.some((m) => !m.fromPatient && !m.readAt);
  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-overline text-muted-foreground uppercase">Hello, {referrer.name.split(" ")[0]}</p>
        <h1 className="text-h1">Referrals</h1>
        <p className="text-muted-foreground">
          Send {practice} referrals, questions and documents such as referral forms, orders and records. They&apos;ll reply
          here, and we&apos;ll email you when they do.
        </p>
      </header>
      <p className="rounded-md bg-warning px-4 py-3 text-small text-warning-foreground">
        <span className="font-semibold">Not for urgent care.</span> For anything urgent, call {practice} directly.
      </p>
      <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <MessageThread
          messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          viewer="portal"
          practiceName={practice}
          empty={`No messages yet. Send ${practice} your first referral.`}
        />
        <MessageComposer
          send={sendReferralMessage}
          label={`Message ${practice}`}
          placeholder="Who you're referring and what they need"
          attachments={{ url: "/api/referral/attachments", max: ATTACHMENTS_MAX, maxBytes: ATTACHMENT_MAX_BYTES }}
        />
      </section>
      <ThreadUpkeep markRead={markReferralPortalRead} hasUnread={hasUnread} />
    </div>
  );
}
