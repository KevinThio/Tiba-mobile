"use client";

import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, FilePenLine, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { initialsOf } from "@/components/practice-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { firstName, formatDayLong, formatDayShort, formatTime, fromDateKey, toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getNotesToDo, listAppointments, type AppointmentSummary } from "./actions";
import { BookAppointmentDialog } from "./book-appointment-dialog";
import { TomorrowCard } from "./tomorrow-card";

type Props = {
  clinicianName: string;
  /** The practice's billing currency (ISO 4217), for the fee on new bookings. */
  currency: string;
  careTypes: { typeOfCare: string; feeMinor: number }[];
};

type Status = "upcoming" | "needs-note" | "draft" | "signed" | "invoiced";

const STATUS_BADGE: Record<Status, { label: string; variant: "outline" | "warning" | "neutral" | "success" }> = {
  upcoming: { label: "Upcoming", variant: "outline" },
  "needs-note": { label: "Needs note", variant: "warning" },
  draft: { label: "Draft", variant: "neutral" },
  signed: { label: "Signed", variant: "success" },
  invoiced: { label: "Invoiced", variant: "success" },
};

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

/** Visit status from the spec: Upcoming → Needs note → Draft → Signed → Invoiced. */
function statusOf(a: AppointmentSummary, now: number): Status {
  if (a.invoiced) return "invoiced";
  if (a.signed) return "signed";
  if (a.draft) return "draft";
  const end = new Date(a.startsAt).getTime() + a.durationMinutes * 60_000;
  return end < now ? "needs-note" : "upcoming";
}

/** Monday of the week that contains `date` (local time). */
function mondayOf(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Clinician Appointments (spec v2 section 4 and the prototype): a week strip with dots for days
 * that have notes to do, the day's visits with their status, a reminder that links to Notes to do,
 * booking, and the Tomorrow card (kept from v1.1).
 */
export function AppointmentsView({ clinicianName, currency, careTypes: initialCareTypes }: Props) {
  // Captured once when the screen opens; used for "today" and visit status.
  const [now] = useState(() => Date.now());
  const todayKey = toDateKey(new Date(now));
  const [selected, setSelected] = useState(todayKey);
  const [week, setWeek] = useState<{ key: string; rows: AppointmentSummary[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [toDo, setToDo] = useState<{ needNote: number; drafts: number } | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [careTypes, setCareTypes] = useState(initialCareTypes);
  // Bumped after each booking so the week, the reminder and the Tomorrow card reload.
  const [version, setVersion] = useState(0);

  const monday = useMemo(() => mondayOf(fromDateKey(selected)), [selected]);
  const weekKey = toDateKey(monday);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);

  const loadWeek = useCallback(
    async (key: string) => {
      const start = fromDateKey(key);
      try {
        const rows = await listAppointments({
          start: start.toISOString(),
          end: addDays(start, 7).toISOString(),
        });
        setWeek({ key, rows });
        setFailed(false);
      } catch {
        setFailed(true);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const start = fromDateKey(weekKey);
    listAppointments({ start: start.toISOString(), end: addDays(start, 7).toISOString() })
      .then((rows) => {
        if (cancelled) return;
        setWeek({ key: weekKey, rows });
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    getNotesToDo()
      .then((counts) => {
        if (!cancelled) setToDo(counts);
      })
      // Not critical: the reminder just doesn't show.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weekKey, version]);

  const loaded = week?.key === weekKey ? week.rows : null;
  const dayVisits = (loaded ?? []).filter((a) => toDateKey(new Date(a.startsAt)) === selected);
  const toDoDays = new Set(
    (loaded ?? [])
      .filter((a) => ["needs-note", "draft"].includes(statusOf(a, now)))
      .map((a) => toDateKey(new Date(a.startsAt))),
  );
  const isToday = selected === todayKey;
  const selectedDate = fromDateKey(selected);

  function onBooked(appointment: AppointmentSummary) {
    setBookingOpen(false);
    const start = new Date(appointment.startsAt);
    setSelected(toDateKey(start));
    // Remember this type of care and its fee for the next booking.
    setCareTypes((types) => [
      { typeOfCare: appointment.typeOfCare, feeMinor: appointment.feeMinor },
      ...types.filter((t) => t.typeOfCare !== appointment.typeOfCare),
    ]);
    setVersion((v) => v + 1);
    toast.success(
      `Done. ${firstName(appointment.patientName)}'s visit is booked for ${formatDayShort(start)} at ${formatTime(start)}.`,
    );
  }

  const title = !loaded
    ? "Appointments"
    : dayVisits.length === 0
      ? "A free day"
      : `${dayVisits.length} ${dayVisits.length === 1 ? "appointment" : "appointments"}`;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        overline={`${isToday ? "Today · " : ""}${formatDayLong(selectedDate)}`}
        title={title}
        actions={
          <>
            {!isToday && (
              <Button variant="secondary" onClick={() => setSelected(todayKey)}>
                <CalendarDays aria-hidden />
                Back to today
              </Button>
            )}
            <Button onClick={() => setBookingOpen(true)}>
              <CalendarPlus aria-hidden />
              Book a visit
            </Button>
          </>
        }
      />

      <WeekStrip
        days={days}
        selected={selected}
        todayKey={todayKey}
        toDoDays={toDoDays}
        onSelect={setSelected}
        onWeek={(step) => setSelected(toDateKey(addDays(fromDateKey(selected), step * 7)))}
      />

      {toDo && (toDo.needNote > 0 || toDo.drafts > 0) && <NotesReminder {...toDo} />}

      {failed ? (
        <div role="alert" className="grid justify-items-center gap-3 rounded-lg border border-border-subtle bg-card px-6 py-10 text-center shadow-sm">
          <TriangleAlert className="size-7 text-destructive" aria-hidden />
          <p className="font-semibold">We couldn&apos;t load your appointments</p>
          <p className="text-small text-muted-foreground">Check your connection and try again. Nothing you&apos;ve written is lost.</p>
          <Button variant="outline" onClick={() => loadWeek(weekKey)}>
            <RotateCcw aria-hidden />
            Try again
          </Button>
        </div>
      ) : !loaded ? (
        <VisitSkeleton />
      ) : dayVisits.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="Nothing booked"
          action={
            <Button variant="outline" onClick={() => setBookingOpen(true)}>
              Book a visit on this day
            </Button>
          }
        >
          {isToday ? "You have no visits today." : "This day is free."}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm" aria-label="Visits">
          {dayVisits.map((a) => (
            <VisitRow key={a.id} visit={a} status={statusOf(a, now)} />
          ))}
        </ul>
      )}

      <TomorrowCard refreshKey={version} />

      <BookAppointmentDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        date={selected}
        clinicianName={clinicianName}
        currency={currency}
        careTypes={careTypes}
        onBooked={onBooked}
      />
    </div>
  );
}

function WeekStrip({
  days,
  selected,
  todayKey,
  toDoDays,
  onSelect,
  onWeek,
}: {
  days: Date[];
  selected: string;
  todayKey: string;
  toDoDays: Set<string>;
  onSelect: (key: string) => void;
  onWeek: (step: -1 | 1) => void;
}) {
  return (
    <section aria-label="Week" className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-small font-semibold text-muted-foreground">{MONTH_YEAR.format(days[3])}</p>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous week" onClick={() => onWeek(-1)}>
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next week" onClick={() => onWeek(1)}>
            <ChevronRight className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((d) => {
          const key = toDateKey(d);
          const isSelected = key === selected;
          const hasToDo = toDoDays.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-pressed={isSelected}
              aria-current={key === todayKey ? "date" : undefined}
              aria-label={`${formatDayLong(d)}${key === todayKey ? ", today" : ""}${hasToDo ? ", notes to do" : ""}`}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-md border-[1.5px] px-0.5 py-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-subtle bg-card hover:bg-muted",
                !isSelected && key === todayKey && "border-primary",
              )}
            >
              <span className={cn("text-caption font-semibold", !isSelected && "text-muted-foreground")}>
                {WEEKDAY.format(d)}
              </span>
              <span className="text-title leading-none font-semibold tabular-nums">{d.getDate()}</span>
              <span
                aria-hidden
                className={cn(
                  "mt-1 size-1.5 rounded-full",
                  hasToDo ? (isSelected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function NotesReminder({ needNote, drafts }: { needNote: number; drafts: number }) {
  const parts = [
    needNote > 0 && `${needNote} finished ${needNote === 1 ? "visit needs a note" : "visits need notes"}`,
    drafts > 0 && `${drafts} ${drafts === 1 ? "draft is" : "drafts are"} waiting`,
  ].filter(Boolean);
  return (
    <Link
      href="/notes"
      className="flex items-center gap-3 rounded-lg bg-accent px-4 py-3.5 text-accent-foreground outline-none hover:bg-accent/80 focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
    >
      <FilePenLine className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{parts.join(" · ")}.</span>
      <ChevronRight className="size-5 shrink-0" aria-hidden />
    </Link>
  );
}

function VisitRow({ visit: a, status }: { visit: AppointmentSummary; status: Status }) {
  const start = new Date(a.startsAt);
  const end = new Date(start.getTime() + a.durationMinutes * 60_000);
  const badge = STATUS_BADGE[status];
  return (
    <li className="border-b border-border-subtle last:border-b-0">
      <Link
        href={`/appointments/${a.id}`}
        className="group flex items-center gap-4 px-4 py-4 outline-none first:rounded-t-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary"
          aria-hidden
        >
          {initialsOf(a.patientName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{a.patientName}</span>
          <span className="block truncate text-small text-muted-foreground tabular-nums">
            {formatTime(start)}–{formatTime(end)} · {a.typeOfCare}
          </span>
        </span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <ChevronRight
          className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}

/** Grey placeholder rows shaped like visits (spec: loading state). */
function VisitSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your appointments" className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-5 py-4 last:border-b-0">
          <span className="size-11 shrink-0 animate-pulse rounded-full bg-sunken" />
          <span className="grid flex-1 gap-2">
            <span className="h-4 w-2/5 animate-pulse rounded-xs bg-sunken" />
            <span className="h-3 w-3/5 animate-pulse rounded-xs bg-sunken" />
          </span>
        </div>
      ))}
      <span className="sr-only">Loading your appointments…</span>
    </div>
  );
}
