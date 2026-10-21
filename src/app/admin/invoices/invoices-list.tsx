"use client";

import { CheckCheck, ChevronRight, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatMoney } from "@/lib/countries";
import { invoiceLabel } from "@/lib/invoice-options";
import { cn } from "@/lib/utils";
import { markAllInvoicesSeen } from "./actions";

type Status = "unpaid" | "paid" | "issue";
type Row = {
  id: string;
  number: number;
  status: Status;
  totalMinor: number;
  currency: string;
  createdAt: string;
  seen: boolean;
  paidOn: string | null;
  issueCategory: string | null;
  patientName: string;
  clinicianId: string;
  clinicianName: string;
};

const TABS: { key: Status; label: string }[] = [
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
  { key: "issue", label: "Issues" },
];
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const DAY = 86_400_000;

/** Tabs with counts, a clinician filter, the total per currency, and rows with New / days / Overdue. */
export function InvoicesList({
  invoices,
  clinicians,
  country,
}: {
  invoices: Row[];
  clinicians: { id: string; name: string }[];
  country: string;
}) {
  const [tab, setTab] = useState<Status>("unpaid");
  const [clinician, setClinician] = useState("");
  const [pending, startTransition] = useTransition();
  // Day counts depend on "now", so they're worked out once on the first render.
  const [now] = useState(() => Date.now());

  const mine = useMemo(() => invoices.filter((i) => !clinician || i.clinicianId === clinician), [invoices, clinician]);
  const counts = { unpaid: 0, paid: 0, issue: 0 };
  for (const i of mine) counts[i.status]++;
  const shown = mine.filter((i) => i.status === tab);
  const unseen = invoices.filter((i) => !i.seen).length;
  // Totals per currency: a practice may have changed currency, so amounts aren't added across them.
  const totals = new Map<string, number>();
  for (const i of shown) totals.set(i.currency, (totals.get(i.currency) ?? 0) + i.totalMinor);
  const totalText = [...totals].map(([currency, minor]) => formatMoney(minor, country, currency)).join(" + ");

  return (
    <div className="grid grid-cols-1 gap-5">
      {unseen > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-accent px-4 py-3 text-accent-foreground">
          <p className="font-semibold">
            {unseen === 1 ? "1 new invoice" : `${unseen} new invoices`} from clinicians since you last looked.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await markAllInvoicesSeen().catch(() => null);
                if (!result?.ok) toast.error("We couldn't save that. Check your connection and try again.");
              })
            }
          >
            <CheckCheck aria-hidden /> Mark all as seen
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Invoices" className="inline-flex w-fit gap-1 rounded-full bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "h-10 rounded-full px-4 text-small font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                tab === t.key ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>
        <NativeSelect
          aria-label="Filter by clinician"
          className="w-full sm:w-64"
          value={clinician}
          onChange={(e) => setClinician(e.target.value)}
        >
          <NativeSelectOption value="">All clinicians</NativeSelectOption>
          {clinicians.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={ReceiptText} title={tab === "issue" ? "No issues" : tab === "paid" ? "Nothing paid yet" : "Nothing unpaid"}>
          {tab === "unpaid"
            ? "Invoices your clinicians send show here until you record a payment."
            : tab === "paid"
              ? "Invoices you mark as paid show here."
              : "Invoices you flag with a problem show here until the issue is resolved."}
        </EmptyState>
      ) : (
        <>
          <p className="text-small text-muted-foreground">
            {shown.length} {shown.length === 1 ? "invoice" : "invoices"} · {totalText} · Newest first.
            {tab !== "paid" && " Open one to mark it paid or flag an issue."}
          </p>
          <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm" aria-label={`${TABS.find((t) => t.key === tab)!.label} invoices`}>
            {shown.map((i) => {
              const days = Math.floor((now - new Date(i.createdAt).getTime()) / DAY);
              return (
                <li key={i.id} className="border-b border-border-subtle last:border-b-0">
                  <Link
                    href={`/admin/invoices/${i.id}`}
                    className="group flex items-center gap-4 px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {i.patientName} · <span className="tabular-nums">{formatMoney(i.totalMinor, country, i.currency)}</span>
                      </span>
                      <span className="block truncate text-small text-muted-foreground">
                        {invoiceLabel(i.number)} · sent {DATE.format(new Date(i.createdAt))} · {i.clinicianName}
                        {i.status === "issue" && i.issueCategory && ` · ${i.issueCategory}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {!i.seen && <Badge variant="info">New</Badge>}
                      {i.status === "unpaid" &&
                        (days > 30 ? (
                          <Badge variant="danger">Overdue</Badge>
                        ) : (
                          <Badge variant="neutral">{days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`}</Badge>
                        ))}
                      {i.status === "paid" && <Badge variant="success">Paid</Badge>}
                      {i.status === "issue" && <Badge variant="danger">Issue</Badge>}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
