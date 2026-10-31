"use client";

import { Check, Megaphone, TriangleAlert, UserCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { DiagnosisPicker, type DiagnosisOption } from "@/components/diagnosis-picker";
import { EmptyState } from "@/components/empty-state";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { aideNeedsSkilledCare, OFFER_FOR, SERVICES, type Service } from "@/lib/patient-options";
import { cn } from "@/lib/utils";
import { addPatient, searchDiagnosisCodes } from "../actions";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export type PatientPrefill = { referralId: string; fullName: string; dateOfBirth: string; insurer: string; referralDate: string; source: string };

export function AddPatientForm({
  clinicians,
  insurers,
  prefill,
}: {
  clinicians: { id: string; name: string; discipline: string | null }[];
  insurers: string[];
  /** From an accepted referral: the details it carried, offered to clinicians by default. */
  prefill?: PatientPrefill;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ name: string; dateOfBirth: string } | null>(null);
  const [pending, setPending] = useState(false);
  // Pick a clinician, or offer the patient to every clinician who does one type of care.
  const [who, setWho] = useState<"pick" | "offer">(prefill ? "offer" : "pick");
  const [offerService, setOfferService] = useState<Service | "">("");
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
      clinicianId: who === "pick" ? get("clinicianId") : "",
      offerService: who === "offer" ? offerService : "",
      insurer: get("insurer"),
      diagnosisCode: diagnosis?.code ?? "",
      servicesOrdered: services,
      orderingDoctor: get("orderingDoctor"),
      referralDate: get("referralDate"),
      startOfCare: get("startOfCare"),
      confirmedNotDuplicate,
      referralId: prefill?.referralId,
    }).catch(() => null);
    setPending(false);
    if (!result) return setError("We couldn't add this patient just now. Check your connection and try again.");
    if (!result.ok) {
      if ("duplicate" in result) return setDuplicate(result.duplicate);
      return setError(result.message);
    }
    toast.success(
      result.offeredTo
        ? `${result.name} is offered to ${result.offeredTo} ${result.offeredTo === 1 ? "clinician" : "clinicians"}. We'll tell you who accepts.`
        : `${result.name} is added to your practice.`,
    );
    router.push("/admin/patients");
  }

  // The type of care offered counts as ordered.
  const ordered = offerService && who === "offer" && !services.includes(offerService) ? [...services, offerService] : services;
  const aideProblem = aideNeedsSkilledCare(ordered);
  const canAccept = (s: Service) => clinicians.filter((c) => c.discipline && OFFER_FOR[s].disciplines.includes(c.discipline)).length;
  const offerCount = offerService ? canAccept(offerService) : 0;

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
        {prefill && <p className="text-small text-muted-foreground">From {prefill.source}&apos;s referral. Check the details before you add them.</p>}
        <FormField label="Full name" name="fullName" autoComplete="off" required defaultValue={prefill?.fullName} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Date of birth" name="dateOfBirth" type="date" max={today} required defaultValue={prefill?.dateOfBirth} />
          <FormField label="Phone (optional)" name="phone" type="tel" autoComplete="off" />
        </div>
        <FormField label="Email (optional)" name="email" type="email" autoComplete="off" hint="Used to send their invoices." />
      </section>

      <section className="grid gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-h3">Care</h2>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">Who will see them</legend>
          <div role="radiogroup" aria-label="Who will see them" className="flex flex-wrap gap-2">
            <ChoiceChip single on={who === "pick"} onClick={() => setWho("pick")}>
              <UserCheck className="size-4" aria-hidden /> Pick a clinician
            </ChoiceChip>
            <ChoiceChip single on={who === "offer"} onClick={() => setWho("offer")}>
              <Megaphone className="size-4" aria-hidden /> Offer to clinicians
            </ChoiceChip>
          </div>
          {who === "pick" ? (
            <SelectField label="Clinician" name="clinicianId" required>
              <NativeSelectOption value="">Pick a clinician</NativeSelectOption>
              {clinicians.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </SelectField>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="offerService">Type of care</Label>
              <NativeSelect
                id="offerService"
                className="w-full"
                required
                value={offerService}
                onChange={(e) => setOfferService(e.target.value as Service | "")}
              >
                <NativeSelectOption value="">Pick the type of care</NativeSelectOption>
                {SERVICES.map((s) => {
                  const n = canAccept(s.value);
                  return (
                    <NativeSelectOption key={s.value} value={s.value} disabled={n === 0}>
                      {s.label} · {n === 0 ? "nobody yet" : `${n} ${n === 1 ? "clinician" : "clinicians"}`}
                    </NativeSelectOption>
                  );
                })}
              </NativeSelect>
              <p className="text-sm text-muted-foreground">
                {offerService
                  ? `We'll email the ${offerCount} ${OFFER_FOR[offerService].who} in your practice. You'll see who accepts, in order, and assign one on the patient's page.`
                  : "Every clinician who does this type of care is emailed. Those who can take the patient accept, and you assign one, usually the first. Clinicians need their role set in Settings to be offered patients."}
              </p>
            </div>
          )}
        </fieldset>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField label="Insurer" name="insurer" defaultValue={prefill?.insurer ?? insurers[0]}>
            {(prefill && !insurers.includes(prefill.insurer) ? [prefill.insurer, ...insurers] : insurers).map((i) => (
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
              const on = ordered.includes(s.value);
              const locked = who === "offer" && s.value === offerService;
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={on}
                  disabled={locked}
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
          <FormField label="Date of referral" name="referralDate" type="date" max={today} required defaultValue={prefill?.referralDate} />
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
          {who === "offer" ? <Megaphone aria-hidden /> : <Check aria-hidden />}
          {pending ? "Adding…" : who === "offer" ? "Add and offer to clinicians" : "Add patient"}
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
