"use client";

import { FileText, Mail, ReceiptText, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDayShort, formatFee, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createInvoice, emailInvoice, listInvoices, listVisitsForInvoicing, type InvoiceSummary, type InvoiceableVisit } from "./actions";
import { InvoiceEmailDialog } from "./invoice-email-dialog";
import { PERIOD_LABELS, type Period } from "./periods";

const label = (n: number) => String(n).padStart(4, "0");
const pdfUrl = (id: string) => `/api/invoices/${id}/pdf`;

export function InvoicesView() {
  const [period, setPeriod] = useState<Period>("1m");
  const [visits, setVisits] = useState<InvoiceableVisit[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [resending, setResending] = useState<InvoiceSummary | null>(null);
  // Bumped after creating or sending an invoice, to reload both lists.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listVisitsForInvoicing(period)
      .then((rows) => !cancelled && setVisits(rows))
      .catch(() => !cancelled && toast.error("We couldn't load your visits. Please refresh the page."));
    return () => {
      cancelled = true;
    };
  }, [period, version]);

  useEffect(() => {
    let cancelled = false;
    listInvoices()
      .then((rows) => !cancelled && setInvoices(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (visits ?? []).filter((v) => !q || v.patientName.toLowerCase().includes(q));
  }, [visits, query]);

  const chosen = useMemo(() => (visits ?? []).filter((v) => selected.has(v.id)), [visits, selected]);
  // An invoice is for one patient: the first ticked visit decides who.
  const patient = chosen[0] ? { id: chosen[0].patientId, name: chosen[0].patientName } : null;
  const totalMinor = chosen.reduce((sum, v) => sum + v.feeMinor, 0);
  const moreForPatient = patient
    ? (visits ?? []).filter((v) => v.patientId === patient.id && v.invoiceNumber === null && !selected.has(v.id))
    : [];

  function changePeriod(next: Period) {
    setPeriod(next);
    setSelected(new Set());
    setVisits(null);
  }

  function toggle(visit: InvoiceableVisit, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(visit.id);
      else next.delete(visit.id);
      return next;
    });
  }

  async function create(email: string) {
    const result = await createInvoice({
      appointmentIds: [...selected],
      email,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (!result.ok) return result.message;
    setCreating(false);
    setSelected(new Set());
    setVersion((v) => v + 1);
    const action = { label: "Open PDF", onClick: () => window.open(pdfUrl(result.invoiceId), "_blank", "noopener") };
    if (result.emailed) toast.success(`Done. Invoice ${label(result.number)} is ready and on its way to ${result.to}.`, { action });
    else if (result.emailError) toast.warning(`Invoice ${label(result.number)} is ready. ${result.emailError}`, { action, duration: 10000 });
    else toast.success(`Done. Invoice ${label(result.number)} is ready.`, { action });
    return null;
  }

  async function resend(email: string) {
    if (!resending) return null;
    const result = await emailInvoice({ invoiceId: resending.id, email });
    if (!result.ok) return result.message;
    setResending(null);
    setVersion((v) => v + 1);
    toast.success(`Sent. Invoice ${label(resending.number)} is on its way to ${result.to}.`);
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-8 pb-24 md:pb-0">
      <PageHeader title="Invoices" description="Tick the visits to bill, then create the invoice. It can be emailed straight away." />

      <section aria-labelledby="visits-heading" className="grid grid-cols-1 gap-4">
        <h2 id="visits-heading" className="sr-only">
          Visits
        </h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="radiogroup" aria-label="Show visits from" className="flex flex-wrap gap-2">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                onClick={() => changePeriod(p)}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  period === p ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Filter by patient name"
              placeholder="Filter by patient"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {visits === null ? (
          <p className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">Loading your visits…</p>
        ) : shown.length === 0 ? (
          <EmptyState icon={ReceiptText} title={query ? "No visits for that name" : "No visits in this period"}>
            {query ? "Try another name, or a longer period." : "Try a longer period, or book visits from Appointments."}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-2" aria-label="Visits">
            {shown.map((v) => {
              const invoiced = v.invoiceNumber !== null;
              const otherPatient = patient !== null && v.patientId !== patient.id;
              const disabled = invoiced || otherPatient;
              const start = new Date(v.startsAt);
              const checkboxId = `visit-${v.id}`;
              return (
                <li key={v.id}>
                  <label
                    htmlFor={checkboxId}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors",
                      selected.has(v.id) && "border-primary/50 bg-secondary/50",
                      disabled ? "opacity-60" : "cursor-pointer hover:bg-muted/60",
                    )}
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={selected.has(v.id)}
                      disabled={disabled}
                      onCheckedChange={(on) => toggle(v, on)}
                      aria-describedby={otherPatient ? `${checkboxId}-why` : undefined}
                    />
                    <div className="w-20 shrink-0 text-sm sm:w-28">
                      <p className="font-medium">{formatDayShort(start)}</p>
                      <p className="text-muted-foreground tabular-nums">{formatTime(start)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{v.patientName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {v.typeOfCare}
                        {(v.timeIn || v.timeOut) &&
                          ` · In ${v.timeIn ? formatTime(new Date(v.timeIn)) : "–"} – Out ${v.timeOut ? formatTime(new Date(v.timeOut)) : "–"}`}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {invoiced && <Badge variant="secondary">On invoice {label(v.invoiceNumber!)}</Badge>}
                        {v.signed ? <Badge variant="success">Note signed</Badge> : <Badge variant="accent">Note to write</Badge>}
                      </div>
                      {otherPatient && (
                        <p id={`${checkboxId}-why`} className="sr-only">
                          An invoice is for one patient at a time.
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-medium tabular-nums">{formatFee(v.feeMinor)}</p>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {patient && (
        <div
          role="region"
          aria-label="Selected visits"
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t bg-card/95 px-4 py-3 shadow-lg backdrop-blur md:sticky md:bottom-6 md:rounded-2xl md:border md:px-5">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{patient.name}</p>
              <p className="text-sm text-muted-foreground">
                {chosen.length} visit{chosen.length === 1 ? "" : "s"} · <span className="tabular-nums">{formatFee(totalMinor)}</span>
                {moreForPatient.length > 0 && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-4"
                      onClick={() => setSelected(new Set([...selected, ...moreForPatient.map((v) => v.id)]))}
                    >
                      Tick all {moreForPatient.length + chosen.length}
                    </button>
                  </>
                )}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
              <X className="size-5" />
            </Button>
            <Button onClick={() => setCreating(true)}>
              <ReceiptText className="size-4" aria-hidden />
              Create invoice
            </Button>
          </div>
        </div>
      )}

      <section aria-labelledby="recent-heading" className="grid grid-cols-1 gap-4">
        <h2 id="recent-heading" className="text-2xl">
          Recent invoices
        </h2>
        {invoices === null ? null : invoices.length === 0 ? (
          <p className="text-muted-foreground">Your invoices will appear here.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-4">
                <div className="w-16 shrink-0 font-heading text-lg text-primary">{label(inv.number)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{inv.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDayShort(new Date(inv.createdAt))} · {inv.visits} visit{inv.visits === 1 ? "" : "s"} ·{" "}
                    <span className="tabular-nums">{formatFee(inv.totalMinor)}</span>
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {inv.sentTo ? `Emailed to ${inv.sentTo} on ${formatDayShort(new Date(inv.sentAt!))}` : "Not emailed yet"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" nativeButton={false} render={<a href={pdfUrl(inv.id)} target="_blank" rel="noopener" />}>
                    <FileText className="size-4" aria-hidden />
                    PDF
                  </Button>
                  <Button variant="outline" onClick={() => setResending(inv)}>
                    <Mail className="size-4" aria-hidden />
                    Email
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InvoiceEmailDialog
        open={creating}
        onOpenChange={setCreating}
        title="Create invoice"
        description="Check the details, then create the invoice."
        summary={patient ? { patientName: patient.name, visits: chosen.length, totalMinor } : undefined}
        defaultEmail={chosen[0]?.invoiceEmail ?? ""}
        emailRequired={false}
        submitLabel={(hasEmail) => (hasEmail ? "Create and email" : "Create invoice")}
        onSubmit={create}
      />
      <InvoiceEmailDialog
        open={resending !== null}
        onOpenChange={(open) => !open && setResending(null)}
        title={resending ? `Email invoice ${label(resending.number)}` : "Email invoice"}
        description="We'll send the invoice as a PDF attachment."
        defaultEmail={resending?.sentTo ?? ""}
        emailRequired
        submitLabel={() => "Send"}
        onSubmit={resend}
      />
    </div>
  );
}
