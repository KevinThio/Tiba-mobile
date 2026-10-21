"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { countryName, countryOptions, currencyFor, currencyLabel, currencyOptions } from "@/lib/countries";
import { updatePractice } from "@/lib/practice-actions";
import { useMounted } from "@/lib/use-mounted";

/**
 * The practice's country and the currency it bills in. The currency follows the country unless
 * the admin picks another. Visits already booked and invoices already made keep their currency.
 */
export function CountryForm({ country, currency }: { country: string; currency: string | null }) {
  const router = useRouter();
  const [place, setPlace] = useState(country);
  // "" means "the country's currency".
  const [money, setMoney] = useState(currency ?? "");
  const [busy, setBusy] = useState(false);
  const changed = place !== country || money !== (currency ?? "");
  const billing = money || currencyFor(place);
  // Names come from the browser's Intl data; until then show codes so hydration matches.
  const mounted = useMounted();
  const countries = useMemo(() => (mounted ? countryOptions() : [{ code: place, name: place }]), [mounted, place]);
  const currencies = useMemo(
    () => (mounted ? currencyOptions() : money ? [{ code: money, name: money }] : []),
    [mounted, money],
  );

  async function save() {
    setBusy(true);
    const result = await updatePractice({ country: place, currency: money || null }).catch(() => null);
    setBusy(false);
    if (!result?.ok) {
      toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
      return;
    }
    toast.success(`Saved. ${countryName(place)} · new fees and invoices use ${currencyLabel(place, billing)}.`);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="country">Country</Label>
          <NativeSelect id="country" className="w-full" value={place} onChange={(e) => setPlace(e.target.value)}>
            {countries.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Billing currency</Label>
          <NativeSelect
            id="currency"
            className="w-full"
            value={money}
            onChange={(e) => setMoney(e.target.value)}
            aria-describedby="currency-hint"
          >
            <NativeSelectOption value="">
              {mounted ? `Same as country: ${currencyLabel(place)}` : "Same as country"}
            </NativeSelectOption>
            {currencies.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <p id="currency-hint" className="text-small text-muted-foreground">
        Fees, invoices, billing and agreements show {mounted ? currencyLabel(place, billing) : "your billing currency"}.
        {changed && " Visits already booked and invoices already made keep their currency."}
      </p>
      {changed && (
        <Button onClick={save} disabled={busy} className="w-fit">
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Save country and currency
        </Button>
      )}
    </div>
  );
}
