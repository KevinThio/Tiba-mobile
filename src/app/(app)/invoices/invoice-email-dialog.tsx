"use client";

import { useState } from "react";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatFee } from "@/lib/format";

/**
 * Confirm step for creating an invoice (or re-sending one). The email is optional when
 * creating: filled in, the PDF is emailed straight away; empty, the invoice is only saved.
 */
export function InvoiceEmailDialog({
  open,
  onOpenChange,
  title,
  description,
  summary,
  defaultEmail,
  emailRequired,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  summary?: { patientName: string; visits: number; totalMinor: number };
  defaultEmail: string;
  emailRequired: boolean;
  submitLabel: (hasEmail: boolean) => string;
  onSubmit: (email: string) => Promise<string | null>; // returns an error message, or null when done
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-primary">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && (
          <EmailForm
            summary={summary}
            defaultEmail={defaultEmail}
            emailRequired={emailRequired}
            submitLabel={submitLabel}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmailForm({
  summary,
  defaultEmail,
  emailRequired,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  summary?: { patientName: string; visits: number; totalMinor: number };
  defaultEmail: string;
  emailRequired: boolean;
  submitLabel: (hasEmail: boolean) => string;
  onSubmit: (email: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const message = await onSubmit(email.trim());
      if (message) setError(message);
    } catch {
      setError("Something went wrong just now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      {summary && (
        <dl className="grid grid-cols-3 gap-3 rounded-2xl bg-muted p-4 text-sm">
          <div className="col-span-3 sm:col-span-1">
            <dt className="text-muted-foreground">Patient</dt>
            <dd className="font-medium">{summary.patientName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Visits</dt>
            <dd className="font-medium">{summary.visits}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-medium tabular-nums">{formatFee(summary.totalMinor)}</dd>
          </div>
        </dl>
      )}
      <FormField
        label={emailRequired ? "Email the invoice to" : "Email the invoice to (optional)"}
        name="invoiceEmail"
        type="email"
        autoComplete="email"
        placeholder="e.g. patient@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required={emailRequired}
        hint="We'll send it as a PDF attachment and remember this address for the patient's next invoice."
      />
      {error && <FormAlert>{error}</FormAlert>}
      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Working on it…" : submitLabel(email.trim().length > 0)}
        </Button>
      </DialogFooter>
    </form>
  );
}
