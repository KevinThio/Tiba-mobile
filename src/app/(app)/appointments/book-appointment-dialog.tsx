"use client";

import { UserRound } from "lucide-react";
import { useState } from "react";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { currencyDigits, moneyInputValue } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { createAppointment, type AppointmentSummary, type BookingInput } from "./actions";
import { PatientPicker, type PatientChoice } from "./patient-picker";

const DURATIONS = [30, 45, 50, 60, 90];
const DEFAULT_CARE_TYPES = ["Individual session", "Couples session", "Family session", "Assessment", "Follow-up"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // YYYY-MM-DD
  clinicianName: string;
  currency: string;
  careTypes: { typeOfCare: string; feeMinor: number }[];
  onBooked: (appointment: AppointmentSummary) => void;
};

export function BookAppointmentDialog({ open, onOpenChange, date, clinicianName, currency, careTypes, onBooked }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-primary">Book a visit</DialogTitle>
          <DialogDescription>Choose the patient, time and type of care.</DialogDescription>
        </DialogHeader>
        {/* Keyed on open so every booking starts from a clean form. */}
        {open && (
          <BookingForm
            key={date}
            date={date}
            clinicianName={clinicianName}
            currency={currency}
            careTypes={careTypes}
            onBooked={onBooked}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookingForm({
  date,
  clinicianName,
  currency,
  careTypes,
  onBooked,
  onCancel,
}: Omit<Props, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [patient, setPatient] = useState<PatientChoice>(null);
  const [typeOfCare, setTypeOfCare] = useState("");
  const [fee, setFee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Types used before come first, topped up with common defaults.
  const suggestions = [...careTypes.map((c) => c.typeOfCare), ...DEFAULT_CARE_TYPES]
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, 6);

  function chooseCareType(type: string) {
    setTypeOfCare(type);
    // Pre-fill the fee charged last time for this type of care.
    const known = careTypes.find((c) => c.typeOfCare === type);
    if (known && !fee) setFee(moneyInputValue(known.feeMinor, currency));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!patient) {
      setError("Choose a patient, or add a new one.");
      return;
    }
    const day = String(form.get("date"));
    const time = String(form.get("time"));
    // Browser local time -> exact instant, so the visit shows at the right time everywhere.
    const startsAt = new Date(`${day}T${time}`);
    if (Number.isNaN(startsAt.getTime())) {
      setError("Add the date and time of the visit.");
      return;
    }
    const input: BookingInput = {
      startsAt: startsAt.toISOString(),
      durationMinutes: Number(form.get("durationMinutes")),
      typeOfCare,
      fee,
      patient:
        patient.kind === "existing"
          ? { kind: "existing", id: patient.patient.id }
          : {
              kind: "new",
              fullName: String(form.get("newPatient.fullName") ?? ""),
              dateOfBirth: String(form.get("newPatient.dateOfBirth") ?? ""),
              gender: String(form.get("newPatient.gender") ?? ""),
              phone: String(form.get("newPatient.phone") ?? ""),
            },
    };
    setPending(true);
    setError(null);
    try {
      const result = await createAppointment(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onBooked(result.appointment);
    } catch {
      setError("We couldn't save the visit just now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate={false}>
      <PatientPicker value={patient} onChange={setPatient} />

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date" name="date" type="date" defaultValue={date} required />
        <FormField label="Time" name="time" type="time" step={300} required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="durationMinutes">Length</Label>
        <NativeSelect id="durationMinutes" name="durationMinutes" defaultValue="60">
          {DURATIONS.map((m) => (
            <NativeSelectOption key={m} value={m}>
              {m} minutes
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="typeOfCare">Type of care</Label>
        <Input
          id="typeOfCare"
          name="typeOfCare"
          value={typeOfCare}
          onChange={(e) => setTypeOfCare(e.target.value)}
          placeholder="e.g. Individual session"
          required
        />
        <div className="flex flex-wrap gap-2">
          {suggestions.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => chooseCareType(type)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                typeOfCare === type ? "border-primary bg-secondary text-primary" : "bg-card hover:bg-muted",
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <FormField
        label={`Fee (${currency})`}
        name="fee"
        inputMode={currencyDigits(currency) ? "decimal" : "numeric"}
        placeholder="e.g. 2500"
        value={fee}
        onChange={(e) => setFee(e.target.value)}
        required
      />

      <p className="flex items-center gap-2 rounded-md bg-muted px-4 py-3 text-sm">
        <UserRound className="size-4 text-primary" aria-hidden />
        <span>
          With <span className="font-medium">{clinicianName}</span>
        </span>
      </p>

      {error && <FormAlert>{error}</FormAlert>}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Booking…" : "Book visit"}
        </Button>
      </DialogFooter>
    </form>
  );
}
