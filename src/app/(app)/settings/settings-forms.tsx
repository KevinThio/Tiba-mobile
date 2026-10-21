"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DISCIPLINES, disciplineLabel, type Discipline } from "@/lib/disciplines";
import { saveDiscipline, saveVisitFee } from "./actions";

/** Your role: the clinician's discipline, saved as soon as it's picked. */
export function DisciplineForm({ discipline }: { discipline: Discipline | null }) {
  const router = useRouter();
  const [value, setValue] = useState<string>(discipline ?? "");
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setBusy(true);
    const result = await saveDiscipline({ discipline: next }).catch(() => null);
    setBusy(false);
    if (!result?.ok) {
      setValue(previous);
      toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
      return;
    }
    toast.success(`Saved. You're set up as a ${disciplineLabel(next as Discipline)}.`);
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="discipline">Discipline</Label>
      <div className="flex items-center gap-3">
        <NativeSelect
          id="discipline"
          className="w-full sm:w-96"
          value={value}
          disabled={busy}
          onChange={(e) => change(e.target.value)}
          aria-describedby="discipline-hint"
        >
          {!value && <NativeSelectOption value="">Pick your discipline</NativeSelectOption>}
          {DISCIPLINES.map((d) => (
            <NativeSelectOption key={d.value} value={d.value}>
              {d.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {busy && <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Saving" />}
      </div>
      <p id="discipline-hint" className="text-small text-muted-foreground">
        {value
          ? "Decides which notes and service plans you can write."
          : "Decides which notes and service plans you can write. Until you pick one, every type of note is offered."}
      </p>
    </div>
  );
}

/** Invoicing: the default visit fee, in the practice's billing currency. */
export function VisitFeeForm({ fee, currency }: { fee: string; currency: string }) {
  const router = useRouter();
  const [value, setValue] = useState(fee);
  // What's saved, as typed ("95"), so the button hides even though the server writes "95.00".
  const [saved, setSaved] = useState(fee);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = value.trim() !== saved;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await saveVisitFee({ fee: value }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save that. Check your connection and try again.");
    setSaved(value.trim());
    toast.success(value.trim() ? "Visit fee saved." : "Visit fee cleared.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-3">
      <FormField
        label={`Visit fee (${currency})`}
        name="visitFee"
        inputMode="decimal"
        placeholder="e.g. 2500"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        error={error ?? undefined}
        hint="Fills in the fee when you book a visit, unless you've charged a different fee for that type of care before."
        className="sm:max-w-60"
      />
      {changed && (
        <Button type="submit" disabled={busy} className="w-fit">
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Save visit fee
        </Button>
      )}
    </form>
  );
}
