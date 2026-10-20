"use client";

import { Check, TriangleAlert, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { DiagnosisPicker, type DiagnosisOption } from "@/components/diagnosis-picker";
import { EmptyState } from "@/components/empty-state";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { aideNeedsSkilledCare, SERVICES, type Service } from "@/lib/patient-options";
import { cn } from "@/lib/utils";
import { addPatient, searchDiagnosisCodes } from "../actions";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function AddPatientForm({
  clinicians,
  insurers,
}: {
  clinicians: { id: string; name: string }[];
  insurers: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ name: string; dateOfBirth: string } | null>(null);
  const [pending, setPending] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (clinicians.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="Add a clinician first"
        action={
          <Button nativeButton={false} render={<Link href="/admin/clinicians" />}>
            Go to Clinicians
          </Button>
        }
      >
        Every patient is seen by one of your clinicians. Once a clinician has joined your practice and you&apos;ve
        activated them, you can add patients for them here.
      </EmptyState>
    );
  }

  async function submit(confirmedNotDuplicate = false) {
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? "");
    setPending(true);
    setError(null);
    const result = await addPatient({
      fullName: get("fullName"),
      dateOfBirth: get("dateOfBirth"),
      phone: get("phone"),
      email: get("email"),
      clinicianId: get("clinicianId"),
      insurer: get("insurer"),
      diagnosisCode: diagnosis?.code ?? "",
      servicesOrdered: services,
      orderingDoctor: get("orderingDoctor"),
      referralDate: get("referralDate"),
      startOfCare: get("startOfCare"),
      confirmedNotDuplicate,
    }).catch(() => null);
    setPending(false);
    if (!result) return setError("We couldn't add this patient just now. Check your connection and try again.");
    if (!result.ok) {
      if ("duplicate" in result) return setDuplicate(result.duplicate);
      return setError(result.message);
    }
    toast.success(`${result.name} is added to your practice.`);
    router.push("/admin/patients");
  }

  const aideProblem = aideNeedsSkilledCare(services);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid max-w-3xl grid-cols-1 gap-6"
      onChange={() => duplicate && setDuplicate(null)}
    >
      <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-h3">Patient</h2>
        <FormField label="Full name" name="fullName" autoComplete="off" required />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Date of birth" name="dateOfBirth" type="date" max={today} required />
          <FormField label="Phone (optional)" name="phone" type="tel" autoComplete="off" />
        </div>
        <FormField label="Email (optional)" name="email" type="email" autoComplete="off" hint="Used to send their invoices." />
      </section>

      <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-h3">Care</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField label="Clinician" name="clinicianId" required>
            <NativeSelectOption value="">Pick a clinician</NativeSelectOption>
            {clinicians.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </SelectField>
          <SelectField label="Insurer" name="insurer" defaultValue={insurers[0]}>
            {insurers.map((i) => (
              <NativeSelectOption key={i} value={i}>
                {i}
              </NativeSelectOption>
            ))}
          </SelectField>
        </div>
        <DiagnosisPicker value={diagnosis} onChange={setDiagnosis} search={searchDiagnosisCodes} />

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">
            Services ordered <span className="font-normal text-muted-foreground">· Pick any</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s) => {
              const on = services.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setServices((list) => (on ? list.filter((x) => x !== s.value) : [...list, s.value]))}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-small font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                    on ? "border-primary bg-secondary text-primary" : "border-input bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {on && <Check className="size-4" aria-hidden />}
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className={cn("text-sm", aideProblem ? "text-destructive" : "text-muted-foreground")}>
            {aideProblem
              ? "An aide can only be ordered with skilled nursing, physical or occupational therapy."
              : "Clinicians see and treat the patient once they are added here."}
          </p>
        </fieldset>

        <FormField label="Ordering doctor (optional)" name="orderingDoctor" autoComplete="off" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Date of referral" name="referralDate" type="date" max={today} required />
          <FormField label="Start of care (optional)" name="startOfCare" type="date" />
        </div>
      </section>

      {duplicate && (
        <div role="alert" className="grid gap-3 rounded-md bg-warning p-4 text-warning-foreground">
          <p className="flex gap-2 font-semibold">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            Possible duplicate. {duplicate.name}, born {dateFormat.format(new Date(duplicate.dateOfBirth))}, is already in
            your practice.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => submit(true)}>
              It&apos;s a different person
            </Button>
            <Button type="button" variant="ghost" nativeButton={false} render={<Link href="/admin/patients" />}>
              Check the patient list
            </Button>
          </div>
        </div>
      )}
      {error && <FormAlert>{error}</FormAlert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending || aideProblem}>
          <Check aria-hidden />
          {pending ? "Adding…" : "Add patient"}
        </Button>
        <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/admin/patients" />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SelectField({
  label,
  name,
  required,
  defaultValue = "",
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <NativeSelect id={name} name={name} className="w-full" required={required} defaultValue={defaultValue}>
        {children}
      </NativeSelect>
    </div>
  );
}
