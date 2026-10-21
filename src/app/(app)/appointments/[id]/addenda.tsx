"use client";

import { Download, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addAddendum } from "./addendum-actions";
import { LocalTime } from "./local-time";

/** Opens the note PDF with times in the viewer's time zone (the zone isn't patient data). */
export function DownloadNotePdf({ appointmentId }: { appointmentId: string }) {
  return (
    <Button
      variant="outline"
      onClick={() => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        window.open(`/api/notes/${appointmentId}/pdf?tz=${encodeURIComponent(tz)}`, "_blank", "noopener");
      }}
    >
      <Download aria-hidden /> Download PDF
    </Button>
  );
}

/**
 * Addenda on a signed note: dated corrections listed under the note, and a form to add one.
 * The note itself never changes, and an addendum can't be edited once saved.
 */
export function Addenda({
  appointmentId,
  clinicianName,
  addenda,
}: {
  appointmentId: string;
  clinicianName: string;
  addenda: { id: string; body: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError("Write what changed, then save.");
    setBusy(true);
    setError(null);
    try {
      const result = await addAddendum({ appointmentId, body });
      if (!result.ok) return setError(result.message);
      setBody("");
      setOpen(false);
      toast.success("Addendum added to the note.");
      router.refresh();
    } catch {
      setError("We couldn't save the addendum. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="addenda-title" className="grid w-full max-w-3xl gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="addenda-title" className="text-h3">
            Addenda
          </h2>
          <p className="text-small text-muted-foreground">
            Corrections and later details. They&apos;re added under the signed note, dated, and can&apos;t be changed.
          </p>
        </div>
        {!open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Plus aria-hidden /> Add an addendum
          </Button>
        )}
      </div>

      {addenda.length > 0 ? (
        <ol className="grid gap-3">
          {addenda.map((a) => (
            <li key={a.id} className="grid gap-1 rounded-md border-l-4 border-l-primary bg-muted px-4 py-3">
              <p className="text-caption text-muted-foreground">
                Added <LocalTime iso={a.createdAt} format="signed" /> by {clinicianName}
              </p>
              <p className="break-words whitespace-pre-line">{a.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        !open && <p className="text-small text-subtle-foreground">No addenda. The note reads as signed.</p>
      )}

      {open && (
        <form onSubmit={save} className="grid gap-3">
          <label htmlFor="addendum-body" className="text-small font-semibold">
            What changed?
          </label>
          <Textarea
            id="addendum-body"
            autoFocus
            rows={4}
            maxLength={5000}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Correction: pain today was 4/10, not 3/10."
            aria-invalid={Boolean(error) || undefined}
          />
          <p className="text-caption text-muted-foreground">Once saved, an addendum can&apos;t be edited or removed.</p>
          {error && <FormAlert>{error}</FormAlert>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {busy ? "Saving…" : "Save addendum"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setBody("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
