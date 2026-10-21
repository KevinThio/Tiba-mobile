"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { setPatientStatus, updatePatientCare } from "../actions";

/** Discharge or Reactivate. */
export function StatusButton({ patientId, name, status }: { patientId: string; name: string; status: "active" | "discharged" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = status === "active" ? "discharged" : "active";
  return (
    <Button
      variant={next === "discharged" ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setPatientStatus({ patientId, status: next }).catch(() => null);
          if (!result?.ok) return void toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
          toast.success(next === "discharged" ? `${name} is discharged.` : `${name} is an active patient again.`);
          router.refresh();
        })
      }
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {next === "discharged" ? "Discharge" : "Reactivate"}
    </Button>
  );
}

type Care = { clinicianId: string; insurer: string; referralDate: string; startOfCare: string };

/** Care: clinician picker, insurer, date of referral and start of care. */
export function CareForm({
  patientId,
  clinicians,
  insurers,
  initial,
}: {
  patientId: string;
  clinicians: { id: string; name: string }[];
  insurers: string[];
  initial: Care;
}) {
  const router = useRouter();
  const [care, setCare] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = JSON.stringify(care) !== JSON.stringify(saved);
  const set = (patch: Partial<Care>) => {
    setCare((c) => ({ ...c, ...patch }));
    if (error) setError(null);
  };
  // Keep an insurer that isn't on the country's list (e.g. typed before) selectable.
  const insurerOptions = care.insurer && !insurers.includes(care.insurer) ? [care.insurer, ...insurers] : insurers;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await updatePatientCare({ patientId, ...care }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save that. Check your connection and try again.");
    setSaved(care);
    toast.success("Care details saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="clinicianId">Clinician</Label>
        <NativeSelect id="clinicianId" className="w-full" value={care.clinicianId} onChange={(e) => set({ clinicianId: e.target.value })}>
          {clinicians.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="insurer">Insurer</Label>
        <NativeSelect id="insurer" className="w-full" value={care.insurer} onChange={(e) => set({ insurer: e.target.value })}>
          <NativeSelectOption value="">Not added</NativeSelectOption>
          {insurerOptions.map((i) => (
            <NativeSelectOption key={i} value={i}>
              {i}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Date of referral" name="referralDate" type="date" value={care.referralDate} onChange={(e) => set({ referralDate: e.target.value })} />
        <FormField label="Start of care" name="startOfCare" type="date" value={care.startOfCare} onChange={(e) => set({ startOfCare: e.target.value })} />
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      {changed && (
        <Button type="submit" className="w-fit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Save care details
        </Button>
      )}
    </form>
  );
}
