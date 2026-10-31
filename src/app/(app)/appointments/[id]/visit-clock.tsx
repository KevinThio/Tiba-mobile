"use client";

import { Clock, Loader2, LogIn, LogOut, MapPin, MonitorSmartphone, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { ClockPlaceBadge } from "@/components/clock-badge";
import { FormAlert } from "@/components/form-alert";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { distanceText, EARLY_CLOCK_IN_MS, type ClockPlace, type Position } from "@/lib/clock-place";
import { changeVisitMode, clockVisit } from "./clock-actions";
import { LocalTime } from "./local-time";

export type ClockView = { at: string; place: ClockPlace; distanceM: number | null; signed: boolean };

/** The phone's position, or why it couldn't be read. */
function currentPosition(): Promise<Position | { error: string }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve({ error: "This browser can't share your location." });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) =>
        resolve({
          error:
            e.code === e.PERMISSION_DENIED
              ? "Tiba isn't allowed to see your location. Allow it for this site in your browser's settings, then try again."
              : "We couldn't find your location. Step outside or near a window, then try again.",
        }),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
    );
  });
}

/**
 * Clock in on arrival and out before leaving (electronic visit verification). In-person visits
 * share the phone's location, which Tiba compares with the patient's home, and the patient signs
 * at clock-out. Virtual visits skip both. Every clock-in and clock-out goes to the administrator.
 */
export function VisitClock({
  appointmentId,
  patientFirstName,
  startsAt,
  virtual,
  clockIn,
  clockOut,
  typedTimes,
  locked,
}: {
  appointmentId: string;
  patientFirstName: string;
  startsAt: string;
  virtual: boolean;
  clockIn: ClockView | null;
  clockOut: ClockView | null;
  /** Times typed in before clocking existed, shown when there's no clock record. */
  typedTimes: { timeIn: string | null; timeOut: string | null };
  /** The note is signed, so nothing can be clocked any more. */
  locked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"in" | "out" | "mode" | null>(null);
  const [finding, setFinding] = useState(false);
  const [problem, setProblem] = useState<{ event: "in" | "out"; message: string } | null>(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const opensAt = new Date(startsAt).getTime() - EARLY_CLOCK_IN_MS;
  const tooEarly = now < opensAt;

  async function clock(event: "in" | "out", withoutLocation = false) {
    setError(null);
    setProblem(null);
    let position: Position | null = null;
    if (!virtual && !withoutLocation) {
      setFinding(true);
      const found = await currentPosition();
      setFinding(false);
      if ("error" in found) return setProblem({ event, message: found.error });
      position = found;
    }
    setBusy(event);
    const result = await clockVisit({ appointmentId, event, position, patientSignature: event === "out" ? signature : null }).catch(() => null);
    setBusy(null);
    if (!result) return setError("We couldn't reach Tiba. Check your connection and try again.");
    if (!result.ok) return setError(result.message);
    const verb = event === "in" ? "Clocked in" : "Clocked out";
    if (result.place === "home" || result.place === "virtual") toast.success(`${verb}.`);
    else
      toast.warning(
        result.place === "away"
          ? `${verb} ${distanceText(result.distanceM ?? 0)} from ${patientFirstName}'s home. Your administrator has been told.`
          : `${verb}. Tiba couldn't check where you were, so your administrator has been told.`,
      );
    setSigning(false);
    setSignature(null);
    router.refresh();
  }

  async function setMode(next: boolean) {
    if (next === virtual) return;
    setBusy("mode");
    const result = await changeVisitMode({ appointmentId, virtual: next }).catch(() => null);
    setBusy(null);
    if (!result?.ok) return toast.error(result?.message ?? "We couldn't change that just now. Please try again.");
    router.refresh();
  }

  const working = busy !== null || finding;

  return (
    <section aria-labelledby="visit-clock-heading" className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="visit-clock-heading" className="flex items-center gap-2 text-h3">
          <Clock className="size-5 text-primary" aria-hidden /> Clock in and out
        </h2>
        {!clockIn && !locked ? (
          <div role="radiogroup" aria-label="Type of visit" className="flex gap-2">
            <ChoiceChip single size="sm" on={!virtual} onClick={() => setMode(false)}>
              <MapPin className="size-4" aria-hidden /> In person
            </ChoiceChip>
            <ChoiceChip single size="sm" on={virtual} onClick={() => setMode(true)}>
              <MonitorSmartphone className="size-4" aria-hidden /> Virtual
            </ChoiceChip>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-small font-semibold text-muted-foreground">
            {virtual ? <MonitorSmartphone className="size-4" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
            {virtual ? "Virtual visit" : "In person"}
          </p>
        )}
      </div>

      <ol className="grid gap-3 sm:grid-cols-2">
        <ClockRow label="Clocked in" icon={LogIn} record={clockIn} typed={!clockIn ? typedTimes.timeIn : null} />
        <ClockRow
          label="Clocked out"
          icon={LogOut}
          record={clockOut}
          typed={!clockIn ? typedTimes.timeOut : null}
          signedBy={!virtual ? patientFirstName : null}
        />
      </ol>

      {!locked && !clockIn && (
        <div className="grid gap-2">
          <Button className="w-full sm:w-fit" disabled={working || tooEarly} onClick={() => clock("in")}>
            {busy === "in" || finding ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
            {finding ? "Finding your location…" : "Clock in"}
          </Button>
          <p className="text-small text-muted-foreground">
            {tooEarly ? (
              <>
                You can clock in from <LocalTime iso={new Date(opensAt).toISOString()} format="signed" />.
              </>
            ) : virtual ? (
              "Tap when the visit starts. Virtual visits don't use your location."
            ) : (
              `Tap when you arrive at ${patientFirstName}'s home. Tiba checks your phone's location and tells your administrator.`
            )}
          </p>
        </div>
      )}

      {!locked && clockIn && !clockOut && !signing && (
        <div className="grid gap-2">
          <Button className="w-full sm:w-fit" disabled={working} onClick={() => (virtual ? clock("out") : setSigning(true))}>
            {busy === "out" || finding ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
            {finding ? "Finding your location…" : "Clock out"}
          </Button>
          <p className="text-small text-muted-foreground">
            {virtual ? "Tap when the visit ends." : `Before you leave, clock out and ask ${patientFirstName} to sign.`}
          </p>
        </div>
      )}

      {!locked && clockIn && !clockOut && signing && (
        <div className="grid gap-3 rounded-md bg-muted p-4">
          <SignaturePad
            name={patientFirstName}
            label={`${patientFirstName}'s signature`}
            onChange={(url) => {
              setSignature(url);
              setError(null);
            }}
          />
          <p className="text-small text-muted-foreground">{patientFirstName} signs to confirm you visited today.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={working || !signature} onClick={() => clock("out")}>
              {busy === "out" || finding ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
              {finding ? "Finding your location…" : "Clock out"}
            </Button>
            <Button
              variant="ghost"
              disabled={working}
              onClick={() => {
                setSigning(false);
                setSignature(null);
                setProblem(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {problem && (
        <div role="alert" className="grid gap-3 rounded-md bg-warning p-4 text-warning-foreground">
          <p className="flex gap-2 font-semibold">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            {problem.message}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={working} onClick={() => clock(problem.event)}>
              Try again
            </Button>
            <Button size="sm" variant="outline" disabled={working} onClick={() => clock(problem.event, true)}>
              Clock {problem.event} without location
            </Button>
          </div>
          <p className="text-small">Without your location, your administrator is told so they can check.</p>
        </div>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      {locked && !clockIn && <p className="text-small text-muted-foreground">This visit wasn&apos;t clocked in.</p>}
    </section>
  );
}

function ClockRow({
  label,
  icon: Icon,
  record,
  typed,
  signedBy = null,
}: {
  label: string;
  icon: typeof LogIn;
  record: ClockView | null;
  typed: string | null;
  signedBy?: string | null;
}) {
  return (
    <li className="grid content-start gap-2 rounded-md border border-border-subtle p-4">
      <p className="flex items-center gap-2 text-small font-semibold text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      {record ? (
        <>
          <p className="text-title font-semibold tabular-nums">
            <LocalTime iso={record.at} format="signed" />
          </p>
          <div className="flex flex-wrap gap-1.5">
            <ClockPlaceBadge place={record.place} distanceM={record.distanceM} />
            {signedBy && record.signed && <span className="text-small text-muted-foreground">{signedBy} signed</span>}
          </div>
        </>
      ) : typed ? (
        <p className="text-small text-muted-foreground">
          Typed in: <LocalTime iso={typed} format="signed" />
        </p>
      ) : (
        <p className="text-small text-muted-foreground">Not yet</p>
      )}
    </li>
  );
}
