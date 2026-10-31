"use client";

import { Loader2, Pencil, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { DiagnosisPicker, type DiagnosisOption } from "@/components/diagnosis-picker";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PatientDetailsInput, PatientDetailsResult } from "@/lib/patient-edit";
import { aideNeedsSkilledCare, SERVICES, type Service } from "@/lib/patient-options";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export type EditablePatient = {
  id: string;
  fullName: string;
  dateOfBirth: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  orderingDoctor: string | null;
  servicesOrdered: string[];
  diagnoses: DiagnosisOption[];
};

/**
 * Edit details on a patient's page (admin and clinician): a button that opens a form to correct
 * the name, date of birth, contact, home address, ordering doctor, services ordered and
 * diagnosis codes.
 * `save` and `search` are each app's Server Actions.
 */
export function EditPatientDetails({
  patient,
  save,
  search,
}: {
  patient: EditablePatient;
  save: (input: PatientDetailsInput) => Promise<PatientDetailsResult>;
  search: (query: string) => Promise<DiagnosisOption[]>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <Pencil aria-hidden /> Edit details
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-primary">Edit details</DialogTitle>
            <DialogDescription>Correct anything that was entered wrong. Changes show everywhere the patient appears.</DialogDescription>
          </DialogHeader>
          {open && <DetailsForm patient={patient} save={save} search={search} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The patient's home address, and a warning when it couldn't be found on the map. */
export function HomeAddress({ address, onMap }: { address: string; onMap: boolean }) {
  return (
    <>
      {address}
      {!onMap && (
        <span className="mt-1 flex gap-1.5 text-small text-warning-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Not found on the map, so clock-ins can&apos;t be checked. Check the address.
        </span>
      )}
    </>
  );
}

function DetailsForm({
  patient,
  save,
  search,
  onDone,
}: {
  patient: EditablePatient;
  save: (input: PatientDetailsInput) => Promise<PatientDetailsResult>;
  search: (query: string) => Promise<DiagnosisOption[]>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(patient.fullName);
  const [dateOfBirth, setDateOfBirth] = useState(patient.dateOfBirth);
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [address, setAddress] = useState(patient.address ?? "");
  const [email, setEmail] = useState(patient.email ?? "");
  const [orderingDoctor, setOrderingDoctor] = useState(patient.orderingDoctor ?? "");
  const [services, setServices] = useState<Service[]>(patient.servicesOrdered.filter((s): s is Service => SERVICES.some((x) => x.value === s)));
  const [diagnoses, setDiagnoses] = useState<DiagnosisOption[]>(patient.diagnoses);
  const [duplicate, setDuplicate] = useState<{ name: string; dateOfBirth: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const aideProblem = aideNeedsSkilledCare(services);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    setPending(true);
    setError(null);
    const result = await save({
      patientId: patient.id,
      fullName,
      dateOfBirth,
      phone,
      address,
      email,
      orderingDoctor,
      servicesOrdered: services,
      diagnosisCodes: diagnoses.map((d) => d.code),
      confirmedNotDuplicate: Boolean(duplicate),
    }).catch(() => null);
    setPending(false);
    if (!result) return setError("We couldn't save that just now. Check your connection and try again.");
    if (!result.ok) {
      if ("duplicate" in result) return setDuplicate(result.duplicate);
      return setError(result.message);
    }
    if (result.addressNotFound) {
      toast.warning(`Saved. We couldn't find ${result.name}'s address on the map, so clock-ins there can't be checked. Check the address.`);
    } else toast.success(`${result.name}'s details are saved.`);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <FormField
        label="Full name"
        name="fullName"
        autoComplete="off"
        required
        value={fullName}
        onChange={(e) => {
          setFullName(e.target.value);
          setDuplicate(null);
        }}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          max={today}
          required
          value={dateOfBirth}
          onChange={(e) => {
            setDateOfBirth(e.target.value);
            setDuplicate(null);
          }}
        />
        <FormField label="Phone (optional)" name="phone" type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <FormField
        label="Home address"
        name="address"
        autoComplete="off"
        hint="Street, town and postcode. Clinicians clock in here on in-person visits."
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <FormField
        label="Email (optional)"
        name="email"
        type="email"
        autoComplete="off"
        hint="Used to send their invoices."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <FormField
        label="Ordering doctor (optional)"
        name="orderingDoctor"
        autoComplete="off"
        value={orderingDoctor}
        onChange={(e) => setOrderingDoctor(e.target.value)}
      />

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">
          Services ordered <span className="font-normal text-muted-foreground">· Pick any</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((s) => {
            const on = services.includes(s.value);
            return (
              <ChoiceChip key={s.value} on={on} onClick={() => setServices((list) => (on ? list.filter((x) => x !== s.value) : [...list, s.value]))}>
                {s.label}
              </ChoiceChip>
            );
          })}
        </div>
        {aideProblem && <p className="text-sm text-destructive">An aide can only be ordered with skilled nursing, physical or occupational therapy.</p>}
      </fieldset>

      <div className="grid gap-2">
        <DiagnosisPicker
          value={null}
          onChange={(option) => option && setDiagnoses((list) => (list.some((x) => x.code === option.code) ? list : [...list, option]))}
          search={search}
          label="Diagnosis codes"
        />
        {diagnoses.length > 0 && (
          <ul className="grid gap-2">
            {diagnoses.map((d) => (
              <li key={d.code} className="flex items-center gap-3 rounded-sm bg-muted py-1.5 pr-1.5 pl-3">
                <span className="w-16 shrink-0 font-semibold tabular-nums">{d.code}</span>
                <span className="min-w-0 flex-1 text-small">{d.description}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${d.code}`}
                  onClick={() => setDiagnoses((list) => list.filter((x) => x.code !== d.code))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {duplicate && (
        <div role="alert" className="grid gap-1 rounded-md bg-warning p-4 text-warning-foreground">
          <p className="flex gap-2 font-semibold">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            {duplicate.name}, born {dateFormat.format(new Date(`${duplicate.dateOfBirth}T00:00:00Z`))}, is already in your practice.
          </p>
          <p className="text-small">Check it isn&apos;t the same person. If it&apos;s someone else, save anyway.</p>
        </div>
      )}
      {error && <FormAlert>{error}</FormAlert>}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || aideProblem}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {duplicate ? "Save anyway" : "Save details"}
        </Button>
      </DialogFooter>
    </form>
  );
}

