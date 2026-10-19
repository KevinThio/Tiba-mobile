"use client";

import { CalendarPlus, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { firstName, formatDayLong, formatDayShort, formatFee, formatTime, fromDateKey, toDateKey } from "@/lib/format";
import { listAppointments, type AppointmentSummary } from "./actions";
import { AppointmentsCalendar } from "./appointments-calendar";
import { BookAppointmentDialog } from "./book-appointment-dialog";
import { TomorrowCard } from "./tomorrow-card";

type Props = {
  clinicianName: string;
  careTypes: { typeOfCare: string; feeMinor: number }[];
};

export function AppointmentsView({ clinicianName, careTypes: initialCareTypes }: Props) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  // Captured once when the screen opens; used for "today" and "note to write".
  const [now] = useState(() => Date.now());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date(now)));
  const [bookingOpen, setBookingOpen] = useState(false);
  const [careTypes, setCareTypes] = useState(initialCareTypes);
  // Bumped after each booking so the Tomorrow card recounts.
  const [bookings, setBookings] = useState(0);
  const range = useRef<{ start: string; end: string } | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (next: { start: string; end: string }) => {
    range.current = next;
    const id = ++requestId.current;
    try {
      const rows = await listAppointments(next);
      if (id === requestId.current) setAppointments(rows);
    } catch {
      toast.error("We couldn't load your appointments. Please refresh the page.");
    }
  }, []);

  const dayAppointments = useMemo(
    () => appointments.filter((a) => toDateKey(new Date(a.startsAt)) === selectedDate),
    [appointments, selectedDate],
  );

  function onBooked(appointment: AppointmentSummary) {
    setBookingOpen(false);
    const start = new Date(appointment.startsAt);
    setSelectedDate(toDateKey(start));
    // Remember this type of care and its fee for the next booking.
    setCareTypes((types) => [
      { typeOfCare: appointment.typeOfCare, feeMinor: appointment.feeMinor },
      ...types.filter((t) => t.typeOfCare !== appointment.typeOfCare),
    ]);
    if (range.current) void load(range.current);
    setBookings((n) => n + 1);
    toast.success(`Done. ${firstName(appointment.patientName)}'s visit is booked for ${formatDayShort(start)} at ${formatTime(start)}.`);
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        title="Appointments"
        description="Tap a day to see its visits, or book a new one."
        actions={
          <Button onClick={() => setBookingOpen(true)}>
            <CalendarPlus className="size-5" aria-hidden />
            Book a visit
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <section aria-label="Calendar" className="rounded-3xl border bg-card p-3 sm:p-5">
          <AppointmentsCalendar
            appointments={appointments}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenAppointment={(id) => router.push(`/appointments/${id}`)}
            onRangeChange={load}
          />
        </section>

        {/* Side column on wide screens. On phones the day comes first and Tomorrow last. */}
        <div className="grid grid-cols-1 gap-6 xl:sticky xl:top-10">
          <DayPanel date={selectedDate} now={now} appointments={dayAppointments} onBook={() => setBookingOpen(true)} />
          <div className="xl:order-first">
            <TomorrowCard refreshKey={bookings} />
          </div>
        </div>
      </div>

      <BookAppointmentDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        date={selectedDate}
        clinicianName={clinicianName}
        careTypes={careTypes}
        onBooked={onBooked}
      />
    </div>
  );
}

function DayPanel({
  date,
  now,
  appointments,
  onBook,
}: {
  date: string;
  now: number;
  appointments: AppointmentSummary[];
  onBook: () => void;
}) {
  const day = fromDateKey(date);
  const isToday = date === toDateKey(new Date(now));

  return (
    <section aria-labelledby="day-heading" className="grid gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="day-heading" className="text-xl">
          {isToday ? "Today" : formatDayLong(day)}
        </h2>
        {isToday && <span className="text-sm text-muted-foreground">{formatDayLong(day)}</span>}
      </div>

      {appointments.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="Nothing booked"
          action={
            <Button variant="outline" onClick={onBook}>
              Book a visit on this day
            </Button>
          }
        >
          This day is free.
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-2">
            {appointments.map((a) => {
              const start = new Date(a.startsAt);
              const end = new Date(start.getTime() + a.durationMinutes * 60_000);
              const needsNote = !a.signed && end.getTime() < now;
              return (
                <li key={a.id}>
                  <Link
                    href={`/appointments/${a.id}`}
                    className="group flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors outline-none hover:border-primary/40 hover:bg-secondary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="w-20 shrink-0 text-center whitespace-nowrap">
                      <p className="font-medium tabular-nums">{formatTime(start)}</p>
                      <p className="text-xs text-muted-foreground">{a.durationMinutes} min</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.patientName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {a.typeOfCare} · {formatFee(a.feeMinor)}
                      </p>
                      {(a.timeIn || a.timeOut) && (
                        <p className="text-sm text-muted-foreground tabular-nums">
                          In {a.timeIn ? formatTime(new Date(a.timeIn)) : "–"} · Out {a.timeOut ? formatTime(new Date(a.timeOut)) : "–"}
                        </p>
                      )}
                      {(a.signed || needsNote) && (
                        <Badge variant={a.signed ? "success" : "accent"} className="mt-2">
                          {a.signed ? "Note signed" : "Note to write"}
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          <Button variant="outline" onClick={onBook}>
            <Clock className="size-4" aria-hidden />
            Book another visit
          </Button>
        </>
      )}
    </section>
  );
}
