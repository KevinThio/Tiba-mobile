"use client";

import { Loader2, PencilLine, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cancelAmendment, startAmendment } from "./amend-actions";
import { LocalTime } from "./local-time";

/** "Amend note" on a signed note: asks why, then reopens the note in the editor. */
export function AmendNote({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function amend(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) return setError("Say briefly what needs correcting, so the record shows why it changed.");
    setBusy(true);
    setError(null);
    try {
      const result = await startAmendment({ appointmentId, reason });
      if (!result.ok) {
        setError(result.message);
        setBusy(false);
        return;
      }
      toast.success("The note is open for your correction. Sign it again when you're done.");
      router.refresh();
    } catch {
      setError("We couldn't open the note. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <PencilLine aria-hidden /> Amend note
      </Button>
    );
  }

  return (
    <form onSubmit={amend} className="grid gap-3 rounded-md border border-border-subtle bg-card p-4">
      <label htmlFor="amend-reason" className="font-semibold">
        What needs correcting?
      </label>
      <Textarea
        id="amend-reason"
        autoFocus
        rows={3}
        maxLength={1000}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          if (error) setError(null);
        }}
        placeholder="e.g. Wrong pain score recorded; it was 4/10."
        aria-invalid={Boolean(error) || undefined}
      />
      <p className="text-caption text-muted-foreground">
        The note opens for editing and you sign it again. The version signed now is kept, with this reason, so the record
        shows what changed.
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <PencilLine aria-hidden />}
          {busy ? "Opening…" : "Open for correction"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Shown in the editor while an amendment is open, with a way to drop it. */
export function AmendmentBanner({
  appointmentId,
  version,
  reason,
  previousSignedAt,
}: {
  appointmentId: string;
  version: number;
  reason: string;
  previousSignedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      const result = await cancelAmendment({ appointmentId });
      if (!result.ok) {
        toast.error(result.message);
        setBusy(false);
        return;
      }
      toast.success("Amendment cancelled. The note is back as it was signed.");
      router.refresh();
    } catch {
      toast.error("We couldn't cancel the amendment. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md bg-warning px-4 py-3.5 text-warning-foreground">
      <PencilLine className="size-5 shrink-0" aria-hidden />
      <div className="grid min-w-[12rem] flex-1 gap-0.5">
        <p className="font-semibold">
          Amending the note signed{" "}
          {previousSignedAt ? <LocalTime iso={previousSignedAt} format="signed" /> : "earlier"} · version {version}
        </p>
        <p className="text-small break-words">Reason: {reason}</p>
        <p className="text-small">The signed version is kept. Make your corrections, then sign again to finish.</p>
      </div>
      <Button variant="outline" size="sm" onClick={cancel} disabled={busy} className="w-full sm:w-auto">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
        Cancel amendment
      </Button>
    </div>
  );
}
