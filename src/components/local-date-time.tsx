"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Formats an instant in the viewer's time zone. The server doesn't know that zone,
 * so it renders nothing and the browser fills it in (no hydration mismatch).
 */
export function LocalDateTime({ iso, options }: { iso: string; options: Intl.DateTimeFormatOptions }) {
  const text = useSyncExternalStore(
    noop,
    () => new Date(iso).toLocaleString(undefined, options),
    () => "",
  );
  return <time dateTime={iso}>{text}</time>;
}
