"use client";

import { Check, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { DiagnosisPicker, type DiagnosisOption } from "@/components/diagnosis-picker";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { aideNeedsSkilledCare, SERVICES, type Service } from "@/lib/patient-options";
import { cn } from "@/lib/utils";
import { searchNoteDiagnoses } from "../../appointments/[id]/note-actions";
import { addPatientAsClinician, checkDuplicate, type DuplicateMatch } from "../actions";
import { NEW_PATIENT_NAME_KEY } from "../patients-view";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Add patient (clinician): name, date of birth, contact, diagnosis, services ordered and the
 * ordering doctor. The duplicate warning shows as soon as the name and date of birth match a
 * practice patient, before saving (spec v2 section 5b).
 */
export function ClinicianAddPatientForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisOption | null>(null);
  // The last duplicate check, for the name and date of birth it was run on.
  const [checked, setChecked] = useState<{ key: string; match: DuplicateMatch | null } | null>(null);
  const key = `${fullName.trim().toLowerCase()}|${dateOfBirth}`;
  const duplicate = checked?.key === key ? checked.match : null;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  // A search with no match on Patients hands its text over to start the name.
  useEffect(() => {
    try {
      const name = sessionStorage.getItem(NEW_PATIENT_NAME_KEY);
      sessionStorage.removeItem(NEW_PATIENT_NAME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after mount
      if (name) setFullName(name);
    } catch {}
  }, []);

  // Live duplicate check once both fields are in.
  useEffect(() => {
    if (!fullName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkDuplicate({ fullName, dateOfBirth })
        .then((match) => !cancelled && setChecked({ key, match }))
        .catch(() => {});
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fullName, dateOfBirth, key]);

  async function submit(askAdminToCheck = false) {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? "");
    setPending(true);
    setError(null);
    const result = await addPatientAsClinician({
      fullName,
      dateOfBirth,
      phone: get("phone"),
      email: get("email"),
      diagnosisCode: diagnosis?.code ?? "",
      servicesOrdered: services,
      orderingDoctor: get("orderingDoctor"),
      askAdminToCheck,
    }).catch(() => null);
    setPending(false);
    if (!result) return setError("We couldn't add this patient just now. Check your connection and try again.");
    if (!result.ok) {
      if ("duplicate" in result) return setChecked({ key, match: result.duplicate });
      return setError(result.message);
    }
    toast.success(
      askAdminToCheck ? `${result.name} is added. Your admin will check the possible duplicate.` : `${result.name} is added to your practice.`,
    );
    router.push(`/patients/${result.id}`);
  }

  const aideProblem = aideNeedsSkilledCare(services);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit(Boolean(duplicate));
      }}
      className="grid max-w-3xl grid-cols-1 gap-6"
    >
      <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-h3">Patient</h2>
        <FormField
          label="Full name"
          name="fullName"
          autoComplete="off"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            max={today}
            required
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
          <FormField label="Phone (optional)" name="phone" type="tel" autoComplete="off" />
        </div>
        <FormField label="Email (optional)" name="email" type="email" autoComplete="off" hint="Used to send their invoices." />

        {duplicate && (
          <div role="alert" className="grid gap-3 rounded-md bg-warning p-4 text-warning-foreground">
            <p className="flex gap-2 font-semibold">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              Possible duplicate. {duplicate.name}, born {dateFormat.format(new Date(duplicate.dateOfBirth))}, is already in
              your practice.
            </p>
            <p className="text-small">
              Open their record if it&apos;s the same person. If not, you can still add them and your admin will check.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" nativeButton={false} render={<Link href={`/patients/${duplicate.id}`} />}>
                Open existing record
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-h3">Care</h2>
        <DiagnosisPicker value={diagnosis} onChange={setDiagnosis} search={searchNoteDiagnoses} />

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">
            Services ordered <span className="font-normal text-muted-foreground">· Pick any</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s) => {
              const on = services.includes(s.value);
              return (
                <ChoiceChip
                  key={s.value}
                  on={on}
                  onClick={() => setServices((list) => (on ? list.filter((x) => x !== s.value) : [...list, s.value]))}
                >
                  {s.label}
                </ChoiceChip>
              );
            })}
          </div>
          <p className={cn("text-sm", aideProblem ? "text-destructive" : "text-muted-foreground")}>
            {aideProblem
              ? "An aide can only be ordered with skilled nursing, physical or occupational therapy."
              : "These decide which notes and plans the care team writes."}
          </p>
        </fieldset>

        <FormField label="Ordering doctor (optional)" name="orderingDoctor" autoComplete="off" />
      </section>

      {error && <FormAlert>{error}</FormAlert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending || aideProblem}>
          <Check aria-hidden />
          {pending ? "Adding…" : duplicate ? "Add and ask admin to check" : "Add patient"}
        </Button>
        <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/patients" />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
