"use client";

import { CalendarX2, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MISSED_REASONS } from "@/lib/missed-reasons";
import { LocalTime } from "./local-time";
import { markVisitMissed, undoVisitMissed } from "./missed-actions";

const OTHER = "Other";

/** "Mark as missed" on a visit that was due and has no note yet: pick why, then confirm. */
export function MarkMissed({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const reason = choice === OTHER ? other.trim() : choice;
    if (!reason) return setError(choice === OTHER ? "Say briefly why the visit was missed." : "Choose why the visit was missed.");
    setBusy(true);
    setError(null);
    try {
      const result = await markVisitMissed({ appointmentId, reason });
      if (!result.ok) {
        setError(result.message);
        setBusy(false);
        return;
      }
      toast.success("Marked as missed. It won't need a note.");
      router.refresh();
    } catch {
      setError("We couldn't save that. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <CalendarX2 aria-hidden /> The visit didn&apos;t happen
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <p id="missed-reason" className="font-semibold">
        Why was the visit missed?
      </p>
      <div role="radiogroup" aria-labelledby="missed-reason" className="flex flex-wrap gap-2">
        {[...MISSED_REASONS, OTHER].map((r) => (
          <ChoiceChip
            key={r}
            single
            on={choice === r}
            onClick={() => {
              setChoice(r);
              if (error) setError(null);
            }}
          >
            {r}
          </ChoiceChip>
        ))}
      </div>
      {choice === OTHER && (
        <Textarea
          aria-label="Why the visit was missed"
          autoFocus
          rows={2}
          maxLength={300}
          value={other}
          onChange={(e) => {
            setOther(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. Road closed by flooding."
        />
      )}
      <p className="text-caption text-muted-foreground">
        A missed visit doesn&apos;t need a note and can&apos;t be invoiced. Your administrator sees it in Performance.
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <CalendarX2 aria-hidden />}
          {busy ? "Saving…" : "Mark as missed"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setChoice(null);
            setOther("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The visit page for a missed visit: when and why, with a way to undo it. */
export function MissedVisit({ appointmentId, reason, missedAt }: { appointmentId: string; reason: string; missedAt: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function undo() {
    setBusy(true);
    try {
      const result = await undoVisitMissed({ appointmentId });
      if (!result.ok) {
        toast.error(result.message);
        setBusy(false);
        return;
      }
      toast.success("No longer missed. You can write the note now.");
      router.refresh();
    } catch {
      toast.error("We couldn't save that. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <h2 className="text-h3">This visit was missed</h2>
      <p>{reason}</p>
      <p className="text-small text-muted-foreground">
        Marked missed <LocalTime iso={missedAt} format="signed" />. It doesn&apos;t need a note and can&apos;t be invoiced.
      </p>
      <Button variant="outline" size="sm" className="w-fit" disabled={busy} onClick={undo}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
        It happened after all
      </Button>
    </section>
  );
}
