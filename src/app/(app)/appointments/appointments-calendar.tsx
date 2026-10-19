"use client";

import FullCalendar, { useCalendarController, type EventInput } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import classicTheme from "@fullcalendar/react/themes/classic";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { firstName, formatTime, toDateKey } from "@/lib/format";
import type { AppointmentSummary } from "./actions";
import "./calendar.css";

type Props = {
  appointments: AppointmentSummary[];
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onOpenAppointment: (id: string) => void;
  onRangeChange: (range: { start: string; end: string }) => void;
};

const isPhone = () => window.matchMedia("(max-width: 767px)").matches;

/** Month calendar with Tiba's own header. Clicking a day selects it; the day panel does the rest. */
export function AppointmentsCalendar({ appointments, selectedDate, onSelectDate, onOpenAppointment, onRangeChange }: Props) {
  const controller = useCalendarController();

  const events = useMemo<EventInput[]>(
    () =>
      appointments.map((a) => {
        const start = new Date(a.startsAt);
        return {
          id: a.id,
          title: a.patientName,
          start,
          end: new Date(start.getTime() + a.durationMinutes * 60_000),
          // Signed visits get a lilac dot.
          ...(a.signed ? { backgroundColor: "#CDBDF4", borderColor: "#2D6A4F" } : {}),
        };
      }),
    [appointments],
  );

  return (
    <div className="tiba-calendar">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl whitespace-nowrap sm:text-2xl" aria-live="polite">
          {controller.view?.title ?? " "}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" onClick={() => controller.today()}>
            Today
          </Button>
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => controller.prev()}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => controller.next()}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      {/* Highlight the selected day by its data-date attribute (theme classes are minified). */}
      <style>{`.tiba-calendar [data-date="${selectedDate}"] { background-color: color-mix(in oklab, var(--lilac) 30%, transparent); box-shadow: inset 0 0 0 2px var(--fern); }`}</style>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin, classicTheme]}
        controller={controller}
        initialView="dayGridMonth"
        headerToolbar={false}
        firstDay={1}
        height="auto"
        fixedWeekCount={false}
        dayMaxEvents={3}
        events={events}
        dayCellClass={(info) => (info.isToday ? "tiba-day tiba-today" : "tiba-day")}
        eventContent={(info) => (
          <span className="tiba-event-text" title={`${info.event.start ? formatTime(info.event.start) : ""} ${info.event.title}`}>
            {firstName(info.event.title)}
          </span>
        )}
        dateClick={(info) => onSelectDate(toDateKey(info.date))}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          // On phones the dots are too small to aim at, so a tap picks the day instead.
          if (isPhone() && info.event.start) onSelectDate(toDateKey(info.event.start));
          else onOpenAppointment(info.event.id);
        }}
        datesSet={(info) => onRangeChange({ start: info.start.toISOString(), end: info.end.toISOString() })}
      />
    </div>
  );
}
