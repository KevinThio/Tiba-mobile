import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MessageComposer, MessageThread, ThreadUpkeep } from "@/components/portal-messages";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { portalAccount, portalConversation } from "@/lib/portal";
import { markConversationRead, replyToPatient } from "../actions";
import { TurnOffButton } from "./turn-off-button";

/** One patient's conversation with the practice, and the admin's reply box. */
export default async function AdminConversationPage({ params }: PageProps<"/admin/messages/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const account = await portalAccount(admin.practiceId, id);
  if (!account || account.status === "pending") notFound();
  const messages = await portalConversation(admin.practiceId, id);
  const hasUnread = messages.some((m) => m.fromPatient && !m.readAt);
  const name = account.patientName ?? account.name;
  const first = name.split(" ")[0];

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/admin/messages", label: "Patient messages" }}
        overline="Patient portal"
        title={name}
        description={account.email}
        actions={
          <div className="flex flex-wrap gap-2">
            {account.patientId && (
              <Button variant="outline" nativeButton={false} render={<Link href={`/admin/patients/${account.patientId}`} />}>
                Patient record
              </Button>
            )}
            {account.status === "active" && <TurnOffButton accountId={account.id} name={name} />}
          </div>
        }
      />
      {account.status === "deactivated" && (
        <p className="rounded-md bg-neutral px-4 py-3 text-neutral-foreground">
          <span className="font-semibold">Portal access is turned off.</span> {name} can&apos;t send or read messages.
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
          <MessageComposer send={replyToPatient.bind(null, account.id)} label={`Reply to ${first}`} placeholder="Write your reply" />
        )}
      </section>
      <ThreadUpkeep markRead={markConversationRead.bind(null, account.id)} hasUnread={hasUnread} />
    </div>
  );
}
