import "server-only";
import { headers } from "next/headers";

// Small in-memory limiter for public forms (patient reviews). Per server process, so
// it resets on restart and isn't shared between instances; enough to stop casual
// flooding. Move to the database or a shared store if Tiba runs on several servers.
const store: Map<string, number[]> = ((globalThis as { __tibaRateLimit?: Map<string, number[]> }).__tibaRateLimit ??=
  new Map<string, number[]>());

/** The caller's IP address, from the proxy headers. */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Records a hit and returns false once `key` has had `limit` hits in the last `windowSeconds`. */
export function allow(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const recent = (store.get(key) ?? []).filter((t) => now - t < windowSeconds * 1000);
  if (recent.length >= limit) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
}
