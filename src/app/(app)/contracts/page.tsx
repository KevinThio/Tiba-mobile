import { ChevronRight, FileSignature } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireClinician } from "@/lib/auth";
import { clinicianContracts } from "@/lib/contract-data";
import { STATUS_BADGE } from "@/lib/contracts";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Contracts from the practice, with "Waiting for you" first (spec v2 section 4 and the prototype). */
export default async function ContractsPage() {
  const clinician = await requireClinician();
  const rows = await clinicianContracts(clinician.id);
  const groups = [
    { key: "sent", title: "Waiting for you", help: "Sign, or message your admin with questions.", rows: rows.filter((r) => r.status === "sent") },
    { key: "feedback", title: "Waiting for your admin", help: "You sent a message. Your admin will reply or send an updated contract.", rows: rows.filter((r) => r.status === "feedback") },
    { key: "signed", title: "Signed", help: "Copies are also in your profile.", rows: rows.filter((r) => r.status === "signed") },
  ].filter((g) => g.rows.length);

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader back={{ href: "/settings", label: "Account" }} overline={clinician.practiceName} title="Contracts" />
      {groups.length === 0 ? (
        <EmptyState icon={FileSignature} title="No contracts yet">
          When your admin sends you a contract, it shows here for you to read and sign.
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-labelledby={`${g.key}-heading`} className="grid gap-3">
            <div>
              <h2 id={`${g.key}-heading`} className="text-h3">
                {g.title} ({g.rows.length})
              </h2>
              <p className="text-small text-muted-foreground">{g.help}</p>
            </div>
            <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
              {g.rows.map((k) => (
                <li key={k.id} className="border-b border-border-subtle last:border-b-0">
                  <Link
                    href={`/contracts/${k.id}`}
                    className="flex items-center gap-4 px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{k.type}</span>
                      <span className="block truncate text-small text-muted-foreground">
                        {k.label}
                        {k.sentAt && ` · sent ${DATE.format(k.sentAt)}`}
                      </span>
                    </span>
                    {k.status === "sent" && !k.seenByClinicianAt && <Badge variant="info">New</Badge>}
                    <Badge variant={STATUS_BADGE[k.status].variant}>{STATUS_BADGE[k.status].label}</Badge>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
