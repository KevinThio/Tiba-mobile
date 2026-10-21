"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clinicians, invoiceEvents, invoices } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ALL_PAYMENT_METHODS, ISSUE_CATEGORIES } from "@/lib/invoice-options";
import { invoiceNumberLabel } from "@/lib/invoice-pdf";
import { clearNotifications, notifyAccount } from "@/lib/notifications";

type Result = { ok: true } | { ok: false; message: string };
const SOMETHING_WRONG = { ok: false as const, message: "Something went wrong. Please refresh the page and try again." };

/** The invoice if it belongs to the admin's practice. */
async function practiceInvoice(invoiceId: string, practiceId: string) {
  if (!z.uuid().safeParse(invoiceId).success) return null;
  const [row] = await db
    .select({ id: invoices.id, number: invoices.number, status: invoices.status, clinicianId: invoices.clinicianId })
    .from(invoices)
    .innerJoin(clinicians, eq(clinicians.id, invoices.clinicianId))
    .where(and(eq(invoices.id, invoiceId), eq(clinicians.practiceId, practiceId)));
  return row ?? null;
}

const refresh = () => revalidatePath("/admin", "layout");

/** Opening an invoice takes away its "New" badge (and its notification). Called from the browser after the page shows. */
export async function markInvoiceSeen(invoiceId: string) {
  const admin = await requireAdmin();
  const invoice = await practiceInvoice(invoiceId, admin.practiceId);
  if (!invoice) return;
  await db.update(invoices).set({ seenAt: new Date() }).where(and(eq(invoices.id, invoice.id), isNull(invoices.seenAt)));
  await clearNotifications(admin.practiceId, "invoice", invoice.id);
  refresh();
}

/** "Mark all as seen" on the Invoices screen. */
export async function markAllInvoicesSeen(): Promise<Result> {
  const admin = await requireAdmin();
  const unseen = await db
    .select({ id: invoices.id })
    .from(invoices)
    .innerJoin(clinicians, eq(clinicians.id, invoices.clinicianId))
    .where(and(eq(clinicians.practiceId, admin.practiceId), isNull(invoices.seenAt)));
  if (unseen.length) {
    const ids = unseen.map((r) => r.id);
    await db.update(invoices).set({ seenAt: new Date() }).where(inArray(invoices.id, ids));
    for (const id of ids) await clearNotifications(admin.practiceId, "invoice", id);
  }
  refresh();
  return { ok: true };
}

const paymentInput = z.object({
  invoiceId: z.string(),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it was paid."),
  method: z.string().refine((m) => ALL_PAYMENT_METHODS.includes(m), "Pick how it was paid."),
});

/** Record payment: from Unpaid or Issue to Paid (spec v2 section 11 acceptance criteria). */
export async function recordPayment(raw: z.input<typeof paymentInput>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = paymentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? SOMETHING_WRONG.message };
  const { invoiceId, paidOn, method } = parsed.data;
  if (paidOn > new Date().toISOString().slice(0, 10)) return { ok: false, message: "The payment date can't be in the future." };
  const invoice = await practiceInvoice(invoiceId, admin.practiceId);
  if (!invoice) return SOMETHING_WRONG;
  if (invoice.status === "paid") return { ok: false, message: "This invoice is already marked as paid." };

  const paid = new Date(`${paidOn}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({ status: "paid", paidOn, paidMethod: method, seenAt: new Date() })
      .where(eq(invoices.id, invoice.id));
    await tx.insert(invoiceEvents).values({ invoiceId: invoice.id, kind: "paid", detail: `${method}, paid ${paid}`, actorId: admin.id });
  });
  await clearNotifications(admin.practiceId, "invoice", invoice.id);
  refresh();
  return { ok: true };
}

const issueInput = z.object({
  invoiceId: z.string(),
  category: z.enum(ISSUE_CATEGORIES, "Pick what's wrong."),
  comment: z.string().trim().min(1, "Add a comment so the clinician knows what to fix.").max(1000),
});

/** Flag issue: needs a category and a comment, moves the invoice to Issues and tells the clinician. */
export async function flagIssue(raw: z.input<typeof issueInput>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = issueInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? SOMETHING_WRONG.message };
  const { invoiceId, category, comment } = parsed.data;
  const invoice = await practiceInvoice(invoiceId, admin.practiceId);
  if (!invoice) return SOMETHING_WRONG;
  if (invoice.status === "paid") return { ok: false, message: "This invoice is paid. Issues can only be flagged on unpaid invoices." };

  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({ status: "issue", issueCategory: category, issueComment: comment, issueFlaggedAt: new Date(), seenAt: new Date() })
      .where(eq(invoices.id, invoice.id));
    await tx.insert(invoiceEvents).values({ invoiceId: invoice.id, kind: "issue_flagged", detail: `${category}: ${comment}`, actorId: admin.id });
  });
  await clearNotifications(admin.practiceId, "invoice", invoice.id);
  await notifyAccount(admin.practiceId, invoice.clinicianId, {
    type: "invoice_issue",
    refId: invoice.id,
    title: `Invoice ${invoiceNumberLabel(invoice.number)} has an issue: ${category}`,
    detail: comment.length > 120 ? `${comment.slice(0, 117)}…` : comment,
    href: "/invoices",
  });
  refresh();
  revalidatePath("/invoices");
  return { ok: true };
}

/** Resolve issue: back to Unpaid. */
export async function resolveIssue(raw: { invoiceId: string }): Promise<Result> {
  const admin = await requireAdmin();
  const invoice = await practiceInvoice(String(raw.invoiceId ?? ""), admin.practiceId);
  if (!invoice) return SOMETHING_WRONG;
  if (invoice.status !== "issue") return { ok: false, message: "This invoice has no open issue." };
  await db.transaction(async (tx) => {
    await tx.update(invoices).set({ status: "unpaid" }).where(eq(invoices.id, invoice.id));
    await tx.insert(invoiceEvents).values({ invoiceId: invoice.id, kind: "issue_resolved", actorId: admin.id });
  });
  await clearNotifications(admin.practiceId, "invoice_issue", invoice.id);
  refresh();
  revalidatePath("/invoices");
  return { ok: true };
}
