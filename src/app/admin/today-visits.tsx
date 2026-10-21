"use client";

import { useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";

type Visit = { id: string; startsAt: string; durationMinutes: number; typeOfCare: string; clinicianName: string; missed: boolean };

const noop = () => () => {};
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "Today across the practice": the viewer's local today, worked out in the browser. */
export function TodayVisits({ visits }: { visits: Visit[] }) {
  const ready = useSyncExternalStore(noop, () => true, () => false);
  if (!ready) return <p className="text-muted-foreground">Loading today&apos;s visits…</p>;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const today = visits.filter((v) => {
    const at = new Date(v.startsAt);
    return at >= start && at < end;
  });

  if (!today.length) {
    return (
      <p className="rounded-lg border border-border-subtle bg-card px-5 py-4 text-muted-foreground shadow-sm">
        No visits booked today.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
      {today.map((v) => {
        const at = new Date(v.startsAt);
        const done = at.getTime() + v.durationMinutes * 60_000 < now.getTime();
        return (
          <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-3 last:border-b-0 sm:px-5">
            <span className="font-semibold tabular-nums">{time.format(at)}</span>
            <span className="min-w-0 flex-1">
              {v.typeOfCare} · <span className="text-muted-foreground">{v.clinicianName}</span>
            </span>
            {v.missed ? <Badge variant="danger">Missed</Badge> : done ? <Badge variant="neutral">Finished</Badge> : null}
          </li>
        );
      })}
    </ul>
  );
}
