"use client";

import { CircleCheck, Flag, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_CATEGORIES } from "@/lib/invoice-options";
import { flagIssue, markInvoiceSeen, recordPayment, resolveIssue } from "../actions";

/** Takes away the "New" badge once the invoice has been shown (not during render). */
export function MarkSeen({ invoiceId }: { invoiceId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markInvoiceSeen(invoiceId).catch(() => {});
  }, [invoiceId]);
  return null;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Record payment, Flag issue and Resolve issue, by status (spec v2 section 5b). */
export function InvoiceActions({
  invoiceId,
  status,
  methods,
  clinicianFirstName,
}: {
  invoiceId: string;
  status: "unpaid" | "paid" | "issue";
  methods: string[];
  clinicianFirstName: string;
}) {
  const router = useRouter();
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState("");
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"pay" | "flag" | "resolve" | null>(null);
  const [error, setError] = useState<{ form: "pay" | "flag" | "resolve"; message: string } | null>(null);

  if (status === "paid") return null;

  async function run(form: "pay" | "flag" | "resolve", action: () => Promise<{ ok: true } | { ok: false; message: string }>, done: string) {
    setBusy(form);
    setError(null);
    const result = await action().catch(() => null);
    setBusy(null);
    if (!result?.ok) return setError({ form, message: result?.message ?? "We couldn't save that. Check your connection and try again." });
    toast.success(done);
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      {status === "issue" && (
        <section className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Resolve issue</h2>
          <p className="text-small text-muted-foreground">Once it&apos;s sorted, the invoice goes back to Unpaid.</p>
          {error?.form === "resolve" && <FormAlert>{error.message}</FormAlert>}
          <Button
            variant="outline"
            className="w-fit"
            disabled={busy !== null}
            onClick={() => run("resolve", () => resolveIssue({ invoiceId }), "Issue resolved. The invoice is unpaid again.")}
          >
            {busy === "resolve" ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
            Resolve issue
          </Button>
        </section>
      )}

      <form
        className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          run("pay", () => recordPayment({ invoiceId, paidOn, method }), "Payment recorded. The invoice is paid.");
        }}
      >
        <h2 className="text-h3">Record payment</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Paid on" name="paidOn" type="date" max={today()} required value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          <div className="grid gap-2">
            <Label htmlFor="paidBy">Paid by</Label>
            <NativeSelect id="paidBy" className="w-full" required value={method} onChange={(e) => setMethod(e.target.value)}>
              <NativeSelectOption value="">Pick one</NativeSelectOption>
              {methods.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {m}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        {error?.form === "pay" && <FormAlert>{error.message}</FormAlert>}
        <Button type="submit" className="w-fit" disabled={busy !== null}>
          {busy === "pay" ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
          Mark as paid
        </Button>
      </form>

      {status === "unpaid" && (
        <form
          className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            run("flag", () => flagIssue({ invoiceId, category: category as (typeof ISSUE_CATEGORIES)[number], comment }), `Issue flagged. ${clinicianFirstName} has been told.`);
          }}
        >
          <h2 className="text-h3">Flag issue</h2>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">What&apos;s wrong?</legend>
            <div role="radiogroup" aria-label="What's wrong" className="flex flex-wrap gap-2">
              {ISSUE_CATEGORIES.map((c) => (
                <ChoiceChip key={c} single size="sm" on={category === c} onClick={() => setCategory(c)}>
                  {c}
                </ChoiceChip>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor="issueComment">Comment</Label>
            <Textarea
              id="issueComment"
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. The fee should be $75, not $90."
            />
            <p className="text-small text-muted-foreground">{clinicianFirstName} sees this in their notifications.</p>
          </div>
          {error?.form === "flag" && <FormAlert>{error.message}</FormAlert>}
          <Button type="submit" variant="outline" className="w-fit" disabled={busy !== null}>
            {busy === "flag" ? <Loader2 className="animate-spin" aria-hidden /> : <Flag aria-hidden />}
            Flag issue
          </Button>
        </form>
      )}
    </div>
  );
}
