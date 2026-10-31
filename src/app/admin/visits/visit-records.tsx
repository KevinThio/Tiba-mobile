"use client";

import { Clock, Loader2, LogIn, LogOut, MonitorSmartphone, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { ClockPlaceBadge } from "@/components/clock-badge";
import { EmptyState } from "@/components/empty-state";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { distanceText, FLAGGED_PLACES, type ClockPlace } from "@/lib/clock-place";
import { cn } from "@/lib/utils";
import { loadClockSignature, markClockNoticesSeen } from "./actions";

type Clock = { at: string; place: ClockPlace; distanceM: number | null; accuracyM: number | null; signed: boolean };
type Row = {
  appointmentId: string;
  startsAt: string;
  typeOfCare: string;
  virtual: boolean;
  patientName: string;
  clinicianId: string;
  clinicianName: string;
  in: Clock | null;
  out: Clock | null;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "flagged", label: "Flagged" },
  { key: "unclocked", label: "Not clocked" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const isFlagged = (r: Row) => [r.in, r.out].some((c) => c && FLAGGED_PLACES.includes(c.place));
const isUnclocked = (r: Row) => !r.in || !r.out;

/** Visit records with All · Flagged · Not clocked tabs and a clinician filter. */
export function VisitRecords({ records, clinicians }: { records: Row[]; clinicians: { id: string; name: string }[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [clinician, setClinician] = useState("");

  useEffect(() => {
    markClockNoticesSeen().catch(() => undefined);
  }, []);

  if (records.length === 0) {
    return (
      <EmptyState icon={Clock} title="No visits yet">
        Visits show here once they&apos;re due, with when and where your clinicians clocked in and out.
      </EmptyState>
    );
  }

  const mine = records.filter((r) => !clinician || r.clinicianId === clinician);
  const counts: Record<Filter, number> = { all: mine.length, flagged: mine.filter(isFlagged).length, unclocked: mine.filter(isUnclocked).length };
  const shown = mine.filter((r) => filter === "all" || (filter === "flagged" ? isFlagged(r) : isUnclocked(r)));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Show visits" className="-mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-[1.5px] px-4 text-small font-semibold transition-colors duration-120 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring",
                filter === f.key ? "border-primary bg-secondary text-primary" : "border-input bg-card hover:bg-muted",
              )}
            >
              {f.label}
              <span className="text-muted-foreground">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <NativeSelect aria-label="Filter by clinician" className="w-full sm:w-64" value={clinician} onChange={(e) => setClinician(e.target.value)}>
          <NativeSelectOption value="">All clinicians</NativeSelectOption>
          {clinicians.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg bg-muted px-5 py-6 text-center text-muted-foreground">
          {filter === "flagged" ? "Nothing flagged. Every clock-in was at the patient's home or virtual." : "Every visit here was clocked in and out."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3" aria-label="Visits">
          {shown.map((r) => (
            <RecordCard key={r.appointmentId} record={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RecordCard({ record: r }: { record: Row }) {
  return (
    <li
      id={`visit-${r.appointmentId}`}
      className="grid scroll-mt-24 gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm target:ring-3 target:ring-ring"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{r.patientName}</p>
          <p className="text-small text-muted-foreground">
            <RelativeDay iso={r.startsAt} withTime /> · {r.clinicianName} · {r.typeOfCare}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {r.virtual && (
            <Badge variant="info">
              <MonitorSmartphone aria-hidden /> Virtual
            </Badge>
          )}
          {!r.in ? <Badge variant="danger">Not clocked in</Badge> : !r.out ? <Badge variant="warning">Still clocked in</Badge> : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ClockCell label="Clocked in" icon={LogIn} clock={r.in} />
        <ClockCell label="Clocked out" icon={LogOut} clock={r.out} appointmentId={r.appointmentId} />
      </div>
    </li>
  );
}

function ClockCell({ label, icon: Icon, clock, appointmentId }: { label: string; icon: typeof LogIn; clock: Clock | null; appointmentId?: string }) {
  return (
    <div className="grid content-start gap-2 rounded-md bg-muted p-4">
      <p className="flex items-center gap-2 text-small font-semibold text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      {clock ? (
        <>
          <p className="font-semibold tabular-nums">
            <RelativeDay iso={clock.at} withTime />
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <ClockPlaceBadge place={clock.place} distanceM={clock.distanceM} />
            {clock.accuracyM !== null && <span className="text-caption text-muted-foreground">Phone accurate to {distanceText(clock.accuracyM)}</span>}
          </div>
          {appointmentId && clock.signed && <Signature appointmentId={appointmentId} />}
        </>
      ) : (
        <p className="text-small text-muted-foreground">Not yet</p>
      )}
    </div>
  );
}

/** "Patient signed", with the signature loaded on request (they're large). */
function Signature({ appointmentId }: { appointmentId: string }) {
  const [image, setImage] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- a signature data URL from Tiba's own database
    return <img src={image} alt="The patient's signature at clock-out" className="h-24 w-full rounded-sm border border-border-subtle bg-white object-contain" />;
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-fit"
      disabled={state === "loading"}
      onClick={async () => {
        setState("loading");
        const url = await loadClockSignature(appointmentId).catch(() => null);
        if (url) setImage(url);
        else setState("failed");
      }}
    >
      {state === "loading" ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
      {state === "failed" ? "Couldn't load it. Try again" : "Patient signed · Show signature"}
    </Button>
  );
}
