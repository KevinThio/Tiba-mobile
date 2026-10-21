"use client";

import { countryName, currencyLabel } from "@/lib/countries";
import { useMounted } from "@/lib/use-mounted";

/** "Kenya · US Dollar (US$)". Names come from the browser's Intl data, so render after mount. */
export function LocalCountry({ country, currency }: { country: string; currency: string }) {
  const mounted = useMounted();
  return <>{mounted ? `${countryName(country)} · ${currencyLabel(country, currency)}` : `${country} · ${currency}`}</>;
}
