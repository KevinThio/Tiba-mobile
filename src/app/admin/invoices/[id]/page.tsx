import { CircleAlert, Download } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { invoiceDetail } from "@/lib/admin-billing";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/countries";
import { invoiceLabel, paymentMethods } from "@/lib/invoice-options";
import { practiceBilling } from "@/lib/practice";
import { InvoiceActions, MarkSeen } from "./invoice-actions";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const STAMP = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const EVENT: Record<string, string> = {
  sent: "Sent",
  issue_flagged: "Issue flagged",
  issue_resolved: "Issue resolved",
  paid: "Marked as paid",
};

/**
 * Admin invoice (spec v2 section 5b and the prototype): details, history, Record payment,
 * Flag issue and Resolve issue, and the PDF. Opening it takes away its "New" badge.
 */
export default async function AdminInvoicePage({ params }: PageProps<"/admin/invoices/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [detail, billing] = await Promise.all([invoiceDetail(id, admin.practiceId), practiceBilling(admin.practiceId)]);
  if (!detail) notFound();
  const { invoice, visits, history } = detail;
  const money = (minor: number) => formatMoney(minor, billing.country, invoice.currency);
  const status =
    invoice.status === "paid" ? (
      <Badge variant="success">Paid</Badge>
    ) : invoice.status === "issue" ? (
      <Badge variant="danger">Issue</Badge>
    ) : (
      <Badge variant="neutral">Unpaid</Badge>
    );

  return (
    <div className="grid grid-cols-1 gap-6">
      {!invoice.seenAt && <MarkSeen invoiceId={invoice.id} />}
      <PageHeader
        back={{ href: "/admin/invoices", label: "Invoices" }}
        overline={`Invoice · ${invoice.clinicianName}`}
        title={`${invoice.patientName} · ${money(invoice.totalMinor)}`}
        actions={
          <Button variant="outline" nativeButton={false} render={<a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener" />}>
            <Download aria-hidden /> Download PDF
          </Button>
        }
      />

      {invoice.status === "issue" && (
        <div role="status" className="flex gap-3 rounded-md bg-danger px-4 py-3.5 text-danger-foreground">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="grid gap-0.5">
            <p className="font-semibold">
              {invoice.issueCategory}
              {invoice.issueFlaggedAt && ` · flagged ${DATE.format(invoice.issueFlaggedAt)}`}
            </p>
            <p className="break-words">{invoice.issueComment}</p>
            <p className="text-small">Waiting for {invoice.clinicianName} to fix it. Resolve it once it&apos;s sorted.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h3">Details</h2>
            {status}
          </div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Number">{invoiceLabel(invoice.number)}</Detail>
            <Detail label="Amount">{money(invoice.totalMinor)}</Detail>
            <Detail label="Patient">{invoice.patientName}</Detail>
            <Detail label="Clinician">{invoice.clinicianName}</Detail>
            <Detail label="Sent">{DATE.format(invoice.createdAt)}</Detail>
            <Detail label="Payment due">
              {invoice.dueDate && invoice.dueDate > invoice.createdAt.toISOString().slice(0, 10)
                ? DATE.format(new Date(`${invoice.dueDate}T00:00:00Z`))
                : "On receipt"}
            </Detail>
            <Detail label="Insurer">{invoice.insurer ?? "Not added"}</Detail>
            <Detail label="Emailed to">{invoice.sentTo ?? "Not emailed"}</Detail>
            {invoice.status === "paid" && (
              <Detail label="Paid">
                {invoice.paidMethod}
                {invoice.paidOn && ` · ${DATE.format(new Date(`${invoice.paidOn}T00:00:00Z`))}`}
              </Detail>
            )}
          </dl>
          <div className="grid gap-2 border-t border-border-subtle pt-4">
            <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
              {visits.length === 1 ? "Visit" : `${visits.length} visits`}
            </p>
            <ul className="grid gap-1.5">
              {visits.map((v) => (
                <li key={v.appointmentId} className="flex justify-between gap-3 text-small">
                  <span className="min-w-0">
                    {DATE.format(v.startsAt)} · {v.typeOfCare}
                  </span>
                  <span className="shrink-0 tabular-nums">{money(v.feeMinor)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="grid gap-6">
          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
            methods={paymentMethods(billing.country)}
            clinicianFirstName={invoice.clinicianName.split(" ")[0]}
          />
          <section className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-h3">History</h2>
            <ol className="grid gap-3">
              {history.map((h) => (
                <li key={h.id} className="grid gap-0.5 border-l-2 border-border-strong pl-3">
                  <p className="text-small font-semibold">
                    {EVENT[h.kind] ?? h.kind}
                    {h.actor && <span className="font-normal text-muted-foreground"> · {h.actor}</span>}
                  </p>
                  {h.detail && <p className="text-small break-words">{h.detail}</p>}
                  <p className="text-caption text-muted-foreground">{STAMP.format(h.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}
