"use client";

import { ChevronRight, FileSignature } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE, type ContractStatus } from "@/lib/contracts";
import { cn } from "@/lib/utils";

type Row = { id: string; label: string; type: string; status: ContractStatus; clinicianName: string; sentAt: string | null; createdAt: string; isNew: boolean };
type Tab = "all" | "sent" | "feedback" | "signed" | "draft";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sent", label: "Waiting" },
  { key: "feedback", label: "Messages" },
  { key: "signed", label: "Signed" },
  { key: "draft", label: "Drafts" },
];
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** Tabs All, Waiting, Messages, Signed and Drafts with counts (spec v2 and the prototype). */
export function ContractsList({ contracts }: { contracts: Row[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const count = (t: Tab) => (t === "all" ? contracts.length : contracts.filter((c) => c.status === t).length);
  const shown = tab === "all" ? contracts : contracts.filter((c) => c.status === tab);

  if (contracts.length === 0) {
    return (
      <EmptyState icon={FileSignature} title="No contracts yet">
        Create one for a clinician: it&apos;s printed on your letterhead, you sign it, and they sign it on their device.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Contracts" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-small font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
              tab === t.key ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label} ({count(t.key)})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-5 py-6 text-center text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm" aria-label="Contracts">
          {shown.map((c) => (
            <li key={c.id} className="border-b border-border-subtle last:border-b-0">
              <Link
                href={`/admin/contracts/${c.id}`}
                className="flex items-center gap-4 px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.clinicianName}</span>
                  <span className="block truncate text-small text-muted-foreground">
                    {c.type} · {c.label} · {c.sentAt ? `sent ${DATE.format(new Date(c.sentAt))}` : `started ${DATE.format(new Date(c.createdAt))}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {c.isNew && <Badge variant="info">New</Badge>}
                  <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
