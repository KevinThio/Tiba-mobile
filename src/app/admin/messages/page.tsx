import { ChevronRight, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ADMIN_SECTIONS } from "@/components/nav-items";
import { PageHeader } from "@/components/page-header";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { linkablePatients, portalConversations, portalRequests } from "@/lib/portal";
import { RequestCard } from "./request-card";

const S = ADMIN_SECTIONS.messages;

/**
 * Patient messages (patient portal): people asking to join, for the admin to confirm against a
 * patient record, then every conversation with the newest first and unread counts.
 */
export default async function AdminMessagesPage() {
  const admin = await requireAdmin();
  const [requests, records, conversations] = await Promise.all([
    portalRequests(admin.practiceId),
    linkablePatients(admin.practiceId),
    portalConversations(admin.practiceId),
  ]);

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline={S.overline} title={S.label} description={S.description} />

      {requests.length > 0 && (
        <section className="grid gap-3" aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="flex items-center gap-2 text-h3">
            Asking to join <Badge variant="warning">{requests.length}</Badge>
          </h2>
          <p className="text-small text-muted-foreground">
            Check each person is really your patient before you confirm. Until then they can&apos;t send or read messages.
          </p>
          <ul className="grid gap-3">
            {requests.map((r) => (
              <RequestCard
                key={r.id}
                request={{ ...r, createdAt: r.createdAt.toISOString() }}
                matches={r.matches}
                others={records.filter((p) => !r.matches.some((m) => m.id === p.id))}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3" aria-labelledby="conversations-heading">
        <h2 id="conversations-heading" className="text-h3">
          Conversations
        </h2>
        {conversations.length ? (
          <ul className="grid overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
            {conversations.map((c) => (
              <li key={c.id} className="border-b border-border-subtle last:border-b-0">
                <Link
                  href={`/admin/messages/${c.id}`}
                  className="flex items-center gap-3 px-5 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{c.patientName ?? c.name}</span>
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
          <EmptyState icon={MessagesSquare} title="No conversations yet">
            Patients sign up from &quot;Patient sign in&quot; on Tiba&apos;s sign-in page. Once you confirm them, their
            messages show here.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
