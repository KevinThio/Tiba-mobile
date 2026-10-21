// Display helpers. Dates and times are shown in the viewer's local time zone.
// Money is formatted in src/lib/countries.ts (the practice's country sets the currency).

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
  // Tiba writes times as 09:30 and dates as "Friday 17 October" whatever the browser's language.
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "Friday 17 October" */
export function formatDayLong(date: Date) {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/** "Fri 17 Oct" */
export function formatDayShort(date: Date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0];
}
