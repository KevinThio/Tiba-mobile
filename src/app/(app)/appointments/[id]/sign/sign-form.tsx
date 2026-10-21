"use client";

import { HandHeart, Loader2, Lock, Maximize2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { PageHeader } from "@/components/page-header";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import type { SummaryGroup } from "@/lib/note-summary";
import { signNote } from "./actions";

type Props = {
  appointmentId: string;
  draftSavedAt: string;
  patientName: string;
  clinicianName: string;
  from: string;
  to: string;
  /** e.g. "Initial evaluation · Physical therapy · M54.5 Low back pain" */
  careLine: string;
  summary: SummaryGroup[];
};

const noop = () => () => {};
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * Sign note: the clinician must sign; the patient's pad is always there but optional, so a note
 * can be saved with the clinician's signature only. The patient can sign in a full-screen box
 * that hides the note.
 */
export function SignForm({ appointmentId, draftSavedAt, patientName, clinicianName, from, to, careLine, summary }: Props) {
  const router = useRouter();
  const first = patientName.split(" ")[0];
  const [mine, setMine] = useState<string | null>(null);
  const [theirs, setTheirs] = useState<string | null>(null);
  // Remounts the inline patient pad so it shows what was signed in the full-screen box.
  const [patientPadKey, setPatientPadKey] = useState(0);
  const [handedOver, setHandedOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: "clinician" | "patient" } | null>(null);

  const when = useSyncExternalStore(
    noop,
    () => `${DATE.format(new Date(from))} · ${TIME.format(new Date(from))}–${TIME.format(new Date(to))}`,
    () => "",
  );

  async function sign() {
    if (!mine) {
      setError({ field: "clinician", message: "Add your signature to save." });
      document.getElementById("clinician-pad")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await signNote({
        appointmentId,
        draftSavedAt,
        clinicianSignature: mine,
        patientSignature: theirs,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!result.ok) {
        setError(result);
        setBusy(false);
        return;
      }
      toast.success(theirs ? `Signed by you and ${first}. The note is locked.` : "Signed. The note is locked.");
      router.replace(`/appointments/${appointmentId}`);
      router.refresh();
    } catch {
      setError({ message: "We couldn't sign the note. Check your connection and try again." });
      setBusy(false);
    }
  }

  const signButton = (
    <Button onClick={sign} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
      {busy ? "Signing…" : "Sign and save"}
    </Button>
  );

  return (
    <div className="grid grid-cols-1 gap-6 pb-24 md:pb-0">
      <PageHeader
        back={{ href: `/appointments/${appointmentId}`, label: "Note" }}
        overline={theirs ? "Both of you sign" : "Your signature"}
        title={`Sign ${first}'s note`}
        actions={<div className="hidden md:flex">{signButton}</div>}
      />

      {error && !error.field && <FormAlert>{error.message}</FormAlert>}

      <section className="grid gap-5 rounded-lg border border-border-subtle bg-muted p-5 shadow-xs sm:p-6" aria-label="Note summary">
        <div className="grid gap-1">
          <h2 className="text-title font-sans font-semibold">{when || " "}</h2>
          <p className="text-small text-muted-foreground">{careLine}</p>
        </div>
        {summary.map((g) => (
          <div key={g.key || "all"} className="grid gap-3">
            {g.name && <h3 className="text-overline font-sans font-semibold text-muted-foreground uppercase">{g.name}</h3>}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
              {g.answers.map((a) => (
                <div key={a.id} className="grid min-w-0 content-start gap-0.5">
                  <dt className="text-caption font-semibold text-primary">{a.label}</dt>
                  <dd className="text-body break-words whitespace-pre-line">{a.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <p className="flex items-center gap-2 text-caption text-muted-foreground">
        <Sparkles className="size-4 shrink-0" aria-hidden />
        Once signed, Tiba writes these sections up as a finished note and locks it.
      </p>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <div id="clinician-pad" className="grid gap-2">
          <SignaturePad
            label="Your signature"
            name={clinicianName}
            invalid={error?.field === "clinician"}
            onChange={(v) => {
              setMine(v);
              if (v && error?.field === "clinician") setError(null);
            }}
          />
          {error?.field === "clinician" && <p className="text-small text-destructive">{error.message}</p>}
        </div>

        <div className="grid gap-2">
          <SignaturePad
            key={patientPadKey}
            label={`${first}'s signature · optional`}
            name={patientName}
            initial={theirs}
            invalid={error?.field === "patient"}
            onChange={(v) => {
              setTheirs(v);
              if (error?.field === "patient") setError(null);
            }}
          />
          {error?.field === "patient" && <p className="text-small text-destructive">{error.message}</p>}
          <p className="flex items-start gap-2 text-caption text-accent-foreground">
            <HandHeart className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Hand the device to {first}. They only see this box, not your notes.
              {!theirs && ` If ${first} can't sign, you can save with your signature only.`}
            </span>
          </p>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setHandedOver(true)}>
            <Maximize2 aria-hidden /> Show {first} only this box
          </Button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex bg-card/95 px-5 py-3 shadow-up backdrop-blur md:hidden [&>button]:flex-1">
        {signButton}
      </div>

      {handedOver && (
        <PatientSignScreen
          first={first}
          patientName={patientName}
          initial={theirs}
          onDone={(v) => {
            setTheirs(v);
            setPatientPadKey((k) => k + 1);
            setHandedOver(false);
          }}
        />
      )}
    </div>
  );
}

/** Full-screen box for the patient: nothing of the note shows while they sign. */
function PatientSignScreen({
  first,
  patientName,
  initial,
  onDone,
}: {
  first: string;
  patientName: string;
  initial: string | null;
  onDone: (signature: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const doneRef = useRef<HTMLButtonElement>(null);
  const latest = useRef({ value, onDone });
  useEffect(() => {
    latest.current = { value, onDone };
  }, [value, onDone]);

  useEffect(() => {
    doneRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && latest.current.onDone(latest.current.value);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-sign-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-background px-5 py-[max(1.5rem,env(safe-area-inset-top))]"
    >
      <div className="grid w-full max-w-2xl gap-6">
        <div className="grid gap-1 text-center">
          <h2 id="patient-sign-title" className="text-h2">
            Please sign here, {first}
          </h2>
          <p className="text-muted-foreground">Your signature goes on today&apos;s visit note. Signing is optional.</p>
        </div>
        <SignaturePad label="Patient signature" name={patientName} initial={initial} onChange={setValue} />
        <Button ref={doneRef} onClick={() => onDone(value)} className="w-full sm:mx-auto sm:w-64">
          {value ? "Done, hand it back" : "Hand it back without signing"}
        </Button>
      </div>
    </div>
  );
}
