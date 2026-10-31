import "server-only";
import { appUrl } from "@/lib/app-url";

// Finds where a patient's address is on the map, so clock-ins can be checked against it. Only the
// address and country are sent, never a name. With GOOGLE_MAPS_API_KEY set it uses Google's
// Geocoding API (Google Cloud signs a HIPAA BAA); otherwise OpenStreetMap's Nominatim, which is
// free but has no BAA, so use it only with test data. Never log the address or the result.

export type HomePosition = { lat: number; lng: number };

const TIMEOUT_MS = 8000;

/** The address's position, or null when it can't be found (or the lookup service is down). */
export async function geocodeAddress(address: string, country: string): Promise<HomePosition | null> {
  const query = address.trim();
  if (!query) return null;
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    return key ? await google(query, country, key) : await nominatim(query, country);
  } catch {
    return null;
  }
}

async function google(address: string, country: string, key: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("region", country.toLowerCase());
  url.searchParams.set("key", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { status: string; results?: { geometry: { location: { lat: number; lng: number } } }[] };
  const at = data.status === "OK" ? data.results?.[0]?.geometry.location : undefined;
  return at && Number.isFinite(at.lat) && Number.isFinite(at.lng) ? { lat: at.lat, lng: at.lng } : null;
}

async function nominatim(address: string, country: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", country.toLowerCase());
  url.searchParams.set("q", address);
  // Nominatim's usage policy asks every app to say who it is.
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    headers: { "User-Agent": `Tiba visit notes (${appUrl() ?? "https://tiba-mobile.vercel.app"})`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string }[];
  const lat = Number(data[0]?.lat);
  const lng = Number(data[0]?.lon);
  return data[0] && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
