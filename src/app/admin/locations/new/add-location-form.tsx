"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { addressOptional, FACILITIES, LOCATION_SERVICES, type Facility } from "@/lib/location-options";
import { cn } from "@/lib/utils";
import { addLocation } from "../actions";

type Service = (typeof LOCATION_SERVICES)[number];

export function AddLocationForm() {
  const router = useRouter();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!facility) return setError("Pick the type of facility.");
    if (!services.length) return setError("Pick at least one service offered here.");
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await addLocation({
      name: String(data.get("name") ?? ""),
      facility,
      address: String(data.get("address") ?? ""),
      services,
    }).catch(() => null);
    setPending(false);
    if (!result) return setError("We couldn't add this location just now. Check your connection and try again.");
    if (!result.ok) return setError(result.message);
    toast.success(`${result.name} is added.`);
    router.push("/admin/locations");
  }

  const optional = facility ? addressOptional(facility) : false;

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl grid-cols-1 gap-6">
      <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <FormField label="Location name" name="name" placeholder="e.g. Camden" autoComplete="off" required />

        <Chips label="Type of facility" hint="Pick one" radio>
          {FACILITIES.map((f) => (
            <Chip
              key={f}
              on={facility === f}
              onClick={() => {
                setFacility(f);
                setError(null);
              }}
              radio
            >
              {f}
            </Chip>
          ))}
        </Chips>

        <FormField
          label={optional ? "Address (optional)" : "Address"}
          name="address"
          autoComplete="off"
          placeholder="e.g. 14 Pratt Street, London NW1 0AE"
          hint={optional ? "Telehealth locations don't need an address." : undefined}
          required={!optional}
        />

        <Chips label="Type of services" hint="Pick any">
          {LOCATION_SERVICES.map((s) => {
            const on = services.includes(s);
            return (
              <Chip
                key={s}
                on={on}
                onClick={() => {
                  setServices((list) => (on ? list.filter((x) => x !== s) : [...list, s]));
                  setError(null);
                }}
              >
                {s}
              </Chip>
            );
          })}
        </Chips>

        <p className="text-small text-muted-foreground">You can upload files for this location once it&apos;s added.</p>
      </section>

      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          <Check aria-hidden />
          {pending ? "Adding…" : "Add location"}
        </Button>
        <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/admin/locations" />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Chips({
  label,
  hint,
  radio = false,
  children,
}: {
  label: string;
  hint: string;
  radio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">
        {label} <span className="font-normal text-muted-foreground">· {hint}</span>
      </legend>
      <div role={radio ? "radiogroup" : undefined} aria-label={radio ? label : undefined} className="flex flex-wrap gap-2">
        {children}
      </div>
    </fieldset>
  );
}

/** Choice chip (design system: 44px minimum, pill). `radio` for pick-one groups. */
function Chip({
  on,
  onClick,
  radio = false,
  children,
}: {
  on: boolean;
  onClick: () => void;
  radio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={radio ? "radio" : undefined}
      aria-checked={radio ? on : undefined}
      aria-pressed={radio ? undefined : on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-small font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
        on ? "border-primary bg-secondary text-primary" : "border-input bg-card text-foreground hover:bg-muted",
      )}
    >
      {on && <Check className="size-4" aria-hidden />}
      {children}
    </button>
  );
}
