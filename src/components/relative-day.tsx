"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "Today", "Yesterday" or "13 Oct", in the viewer's time zone. */
export function relativeDay(date: Date, now = new Date()) {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return DAY.format(date);
}

/**
 * The day (and optionally the time) of an instant, as the prototype writes it:
 * "Today · 14:00", "Yesterday", "13 Oct · 09:00". Rendered in the browser because the
 * server doesn't know the viewer's time zone.
 */
export function RelativeDay({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const text = useSyncExternalStore(
    noop,
    () => {
      const date = new Date(iso);
      return withTime ? `${relativeDay(date)} · ${TIME.format(date)}` : relativeDay(date);
    },
    () => "",
  );
  return <time dateTime={iso}>{text}</time>;
}

/** "Edited 10:02" today, otherwise "Edited yesterday" or "Edited 13 Oct". */
export function EditedAt({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    noop,
    () => {
      const date = new Date(iso);
      const day = relativeDay(date);
      return day === "Today" ? `Edited ${TIME.format(date)}` : `Edited ${day === "Yesterday" ? "yesterday" : day}`;
    },
    () => "",
  );
  return <time dateTime={iso}>{text}</time>;
}
