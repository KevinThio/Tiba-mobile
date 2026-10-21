"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

const FORMATS = {
  /** "16 Oct 2026 · 10:30–11:20" (needs `to`) */
  visit: (from: Date, to?: Date) => `${DATE.format(from)} · ${TIME.format(from)}${to ? `–${TIME.format(to)}` : ""}`,
  /** "11:22, 16 Oct" */
  signed: (at: Date) => `${TIME.format(at)}, ${SHORT.format(at)}`,
  /** "11:22" */
  time: (at: Date) => TIME.format(at),
};

/** Dates and times on the signed note, in the viewer's time zone (the server doesn't know it). */
export function LocalTime({ iso, to, format }: { iso: string; to?: string; format: keyof typeof FORMATS }) {
  const text = useSyncExternalStore(
    noop,
    () => FORMATS[format](new Date(iso), to ? new Date(to) : undefined),
    () => "",
  );
  return <time dateTime={iso}>{text}</time>;
}
