// Display helpers. Dates and times are shown in the viewer's local time zone.
// The currency isn't decided yet, so fees are shown as plain amounts.

const feeFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 150000 -> "1,500.00" */
export function formatFee(minor: number) {
  return feeFormat.format(minor / 100);
}

/** "1,500.5" -> 150050. Returns null if it isn't a sensible amount. */
export function parseFeeToMinor(input: string): number | null {
  const cleaned = input.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Age in whole years from a "YYYY-MM-DD" date of birth. */
export function ageFrom(dateOfBirth: string, today = new Date()) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

/** Local calendar day of a Date as "YYYY-MM-DD" (not UTC, unlike toISOString). */
export function toDateKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" -> local midnight Date. */
export function fromDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** "Friday 17 October" */
export function formatDayLong(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

/** "Fri 17 Oct" */
export function formatDayShort(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0];
}
