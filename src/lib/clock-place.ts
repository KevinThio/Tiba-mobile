// Where a clinician clocked in or out, compared with the patient's home (shared by the server and
// both apps). Phone positions and map lookups are each off by tens of metres, more indoors, so
// anything within HOME_RADIUS_M of the home counts as there.

export type ClockPlace = "home" | "away" | "unknown" | "no_home" | "virtual";
export type Position = { latitude: number; longitude: number; accuracy: number };

export const HOME_RADIUS_M = 250;

/** Clock in from this long before the booked start. */
export const EARLY_CLOCK_IN_MS = 2 * 60 * 60_000;

/** Places the admin is told about straight away (by email as well as in Tiba). */
export const FLAGGED_PLACES: ClockPlace[] = ["away", "unknown", "no_home"];

/** Metres between two points (haversine). */
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** "120 m", "2.3 km". */
export function distanceText(metres: number) {
  return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** Short label for badges and notifications: "At the patient's home", "2.3 km away". */
export function placeLabel(place: ClockPlace, distanceM: number | null) {
  switch (place) {
    case "home":
      return "At the patient's home";
    case "away":
      return `${distanceText(distanceM ?? 0)} from the patient's home`;
    case "unknown":
      return "Location not shared";
    case "no_home":
      return "Patient's address not on the map";
    case "virtual":
      return "Virtual visit";
  }
}

export const PLACE_BADGE: Record<ClockPlace, "success" | "danger" | "warning" | "info"> = {
  home: "success",
  away: "danger",
  unknown: "warning",
  no_home: "warning",
  virtual: "info",
};
