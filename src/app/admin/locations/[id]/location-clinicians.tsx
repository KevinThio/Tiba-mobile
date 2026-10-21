"use client";

import { Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { initialsOf } from "@/components/practice-mark";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { setClinicianLocation } from "../actions";

type Clinician = { id: string; name: string; role: string; locationId: string | null; locationName: string | null };

/** The clinicians based at a location, with Add and Remove (spec v2 location profile). */
export function LocationClinicians({ locationId, locationName, clinicians }: { locationId: string; locationName: string; clinicians: Clinician[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [choice, setChoice] = useState("");
  const here = clinicians.filter((c) => c.locationId === locationId);
  const others = clinicians.filter((c) => c.locationId !== locationId);
  const first = (name: string) => name.split(" ")[0];

  function save(clinician: Clinician, to: string | null) {
    setBusyId(clinician.id);
    startTransition(async () => {
      const result = await setClinicianLocation({ clinicianId: clinician.id, locationId: to }).catch(() => null);
      setBusyId(null);
      if (!result?.ok) return void toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
      toast.success(to ? `${first(clinician.name)} is now based at ${locationName}.` : `${first(clinician.name)} is no longer based at ${locationName}.`);
      setChoice("");
      router.refresh();
    });
  }

  const picked = others.find((c) => c.id === choice);

  return (
    <div className="grid gap-4">
      {here.length ? (
        <ul className="grid grid-cols-1 gap-2">
          {here.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-sm bg-muted px-3 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-caption font-semibold text-primary" aria-hidden>
                {initialsOf(c.name)}
              </span>
              <span className="min-w-0 flex-1">
                <Link href={`/admin/clinicians/${c.id}`} className="block truncate font-semibold underline-offset-2 hover:underline">
                  {c.name}
                </Link>
                <span className="block truncate text-small text-muted-foreground">{c.role}</span>
              </span>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => save(c, null)} aria-label={`Remove ${c.name} from ${locationName}`}>
                {busyId === c.id ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No clinicians are based here yet.</p>
      )}

      {others.length > 0 ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (picked) save(picked, locationId);
          }}
        >
          <Label htmlFor="add-clinician">Add a clinician</Label>
          <div className="flex flex-wrap gap-2">
            <NativeSelect id="add-clinician" className="min-w-0 flex-1" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <NativeSelectOption value="">Choose a clinician</NativeSelectOption>
              {others.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name} · {c.locationName ? `at ${c.locationName}` : "no location"}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button type="submit" disabled={!picked || pending}>
              {pending && busyId === picked?.id ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              Add
            </Button>
          </div>
          {picked?.locationName && (
            <p className="text-small text-muted-foreground">
              {first(picked.name)} moves here from {picked.locationName}. Clinicians are based at one location.
            </p>
          )}
        </form>
      ) : (
        here.length > 0 && <p className="text-small text-muted-foreground">Every clinician in your practice is based here.</p>
      )}
    </div>
  );
}
