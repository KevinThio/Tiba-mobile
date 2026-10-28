import { Hourglass, UserX } from "lucide-react";
import { MessageComposer, MessageThread, ThreadUpkeep } from "@/components/portal-messages";
import { requirePatient } from "@/lib/auth";
import { portalConversation } from "@/lib/portal";
import { markPortalRead, sendPortalMessage } from "./actions";

/**
 * The patient's portal: waiting for the practice to confirm them, turned off, or their messages
 * with the practice and a box to write a new one.
 */
export default async function PortalPage() {
  const patient = await requirePatient();
  const practice = patient.practiceName;

  if (patient.status !== "active") {
    const off = patient.status === "deactivated";
    const Icon = off ? UserX : Hourglass;
    return (
      <section className="mx-auto grid max-w-form gap-4 py-10 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-7" aria-hidden />
        </span>
        <h1 className="text-h2">{off ? "Your portal account is turned off" : `Waiting for ${practice}`}</h1>
        <p className="text-muted-foreground">
          {off
            ? `${practice} couldn't confirm your account, or turned it off. If you're their patient, please contact them directly.`
            : `${practice} checks your name and date of birth against their records. We'll email you at ${patient.email} once they confirm it's you, and then you can send them messages.`}
        </p>
      </section>
    );
  }

  const messages = await portalConversation(patient.practiceId, patient.id);
  const hasUnread = messages.some((m) => !m.fromPatient && !m.readAt);
  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-overline text-muted-foreground uppercase">Hello, {patient.name.split(" ")[0]}</p>
        <h1 className="text-h1">Messages</h1>
        <p className="text-muted-foreground">
          Write to {practice} about anything you need: appointments, questions or paperwork. They&apos;ll reply here, and
          we&apos;ll email you when they do.
        </p>
      </header>
      <p className="rounded-md bg-warning px-4 py-3 text-small text-warning-foreground">
        <span className="font-semibold">Not for emergencies.</span> If you need urgent help, call your local emergency number.
      </p>
      <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <MessageThread
          messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          viewer="portal"
          practiceName={practice}
          empty={`No messages yet. Say hello to ${practice}.`}
        />
        <MessageComposer send={sendPortalMessage} label={`Message ${practice}`} placeholder="Write your message" />
      </section>
      <ThreadUpkeep markRead={markPortalRead} hasUnread={hasUnread} />
    </div>
  );
}
