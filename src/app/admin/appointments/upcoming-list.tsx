"use client";

import { CalendarDays } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/empty-state";
import { initialsOf } from "@/components/practice-mark";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Visit = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  typeOfCare: string;
  patientName: string;
  clinicianId: string;
  clinicianName: string;
};

const noop = () => () => {};
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short" });

/** Groups visits by the viewer's local day ("Today · Friday 16 Oct"), with a clinician filter. */
export function UpcomingList({ appointments, clinicians }: { appointments: Visit[]; clinicians: { id: string; name: string }[] }) {
  const [clinicianId, setClinicianId] = useState("");
  // The server doesn't know the viewer's time zone, so days are worked out in the browser.
  const ready = useSyncExternalStore(noop, () => true, () => false);
  if (!ready) return <p className="text-muted-foreground">Loading appointments…</p>;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dayKey(now);
  const tomorrow = new Date(startOfToday);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const upcoming = appointments.filter(
    (a) => new Date(a.startsAt) >= startOfToday && (!clinicianId || a.clinicianId === clinicianId),
  );
  const days: { key: string; label: string; visits: Visit[] }[] = [];
  for (const a of upcoming) {
    const d = new Date(a.startsAt);
    const key = dayKey(d);
    let day = days.find((x) => x.key === key);
    if (!day) {
      const prefix = key === todayKey ? "Today · " : key === dayKey(tomorrow) ? "Tomorrow · " : "";
      day = { key, label: prefix + dayName.format(d), visits: [] };
      days.push(day);
    }
    day.visits.push(a);
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor="clinician-filter">Clinician</Label>
        <NativeSelect id="clinician-filter" className="w-full" value={clinicianId} onChange={(e) => setClinicianId(e.target.value)}>
          <NativeSelectOption value="">All clinicians</NativeSelectOption>
          {clinicians.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {days.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nothing booked">
          {clinicianId
            ? "This clinician has no upcoming visits. Try All clinicians."
            : "When your clinicians book visits, they show here, soonest first."}
        </EmptyState>
      ) : (
        days.map((day) => (
          <section key={day.key} aria-label={day.label} className="grid gap-3">
            <h2 className="text-h3">{day.label}</h2>
            <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
              {day.visits.map((v) => {
                const start = new Date(v.startsAt);
                const end = new Date(start.getTime() + v.durationMinutes * 60_000);
                return (
                  <li key={v.id} className="flex items-center gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0 sm:px-5">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary"
                      aria-hidden
                    >
                      {initialsOf(v.patientName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{v.patientName}</p>
                      <p className="truncate text-small text-muted-foreground">
                        {time.format(start)}–{time.format(end)} · {v.typeOfCare} · {v.clinicianName}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
