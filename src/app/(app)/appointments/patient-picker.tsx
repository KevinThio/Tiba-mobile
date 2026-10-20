"use client";

import { Check, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ageFrom, toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { searchPatients, type PatientOption } from "./actions";

export type PatientChoice = { kind: "existing"; patient: PatientOption } | { kind: "new" } | null;

/**
 * Choose an existing patient (search by name, typos are fine) or add a new one.
 * New-patient fields are plain inputs named newPatient.*, read by the booking form on submit.
 */
export function PatientPicker({ value, onChange }: { value: PatientChoice; onChange: (choice: PatientChoice) => void }) {
  const mode = value?.kind === "new" ? "new" : "existing";

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm font-medium">Patient</legend>
      <div role="radiogroup" aria-label="Patient" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        <ModeButton active={mode === "existing"} onClick={() => onChange(null)}>
          <Search className="size-4" aria-hidden /> Find a patient
        </ModeButton>
        <ModeButton active={mode === "new"} onClick={() => onChange({ kind: "new" })}>
          <UserPlus className="size-4" aria-hidden /> New patient
        </ModeButton>
      </div>
      {mode === "existing" ? <PatientSearch value={value} onChange={onChange} /> : <NewPatientFields />}
    </fieldset>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex h-10 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
        active ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function PatientSearch({ value, onChange }: { value: PatientChoice; onChange: (choice: PatientChoice) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientOption[] | null>(null);
  const selected = value?.kind === "existing" ? value.patient : null;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchPatients(query);
      if (!cancelled) setResults(found);
    }, query ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="grid gap-2">
      <Label htmlFor="patient-search" className="sr-only">
        Search patients by name
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="patient-search"
          type="search"
          placeholder="Search by name"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {results === null ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">Looking…</p>
      ) : results.length === 0 ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">
          {query ? "No one by that name yet. Choose “New patient” to add them." : "No patients yet. Choose “New patient” to add your first."}
        </p>
      ) : (
        <ul role="listbox" aria-label="Patients" className="grid max-h-56 gap-1 overflow-y-auto rounded-md border bg-card p-1">
          {!query && <li className="px-3 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">Recently added</li>}
          {results.map((p) => {
            const isSelected = selected?.id === p.id;
            return (
              <li key={p.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => onChange({ kind: "existing", patient: p })}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring",
                    isSelected ? "bg-secondary text-primary" : "hover:bg-muted",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.fullName}</span>
                    <span className="block text-sm text-muted-foreground">
                      {ageFrom(p.dateOfBirth)} years{p.phone ? ` · ${p.phone}` : ""}
                    </span>
                  </span>
                  {isSelected && <Check className="size-5 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NewPatientFields() {
  return (
    <div className="grid gap-4 rounded-md border border-dashed p-4">
      <FormField label="Full name" name="newPatient.fullName" autoComplete="off" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date of birth" name="newPatient.dateOfBirth" type="date" max={toDateKey(new Date())} required />
        <div className="grid gap-2">
          <Label htmlFor="newPatient.gender">Gender (optional)</Label>
          <NativeSelect id="newPatient.gender" name="newPatient.gender" defaultValue="">
            <NativeSelectOption value="">Prefer not to say</NativeSelectOption>
            <NativeSelectOption value="Female">Female</NativeSelectOption>
            <NativeSelectOption value="Male">Male</NativeSelectOption>
            <NativeSelectOption value="Non-binary">Non-binary</NativeSelectOption>
            <NativeSelectOption value="Other">Other</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <FormField label="Phone (optional)" name="newPatient.phone" type="tel" autoComplete="off" />
      <p className="text-sm text-muted-foreground">You can add their address and diagnosis later in their patient record.</p>
    </div>
  );
}
