"use client";

import { MapPin, MonitorSmartphone, UserRound } from "lucide-react";
import { useState } from "react";
import { ChoiceChip } from "@/components/choice-chip";
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

// Length is hours plus minutes, up to 24 hours (aide shifts can run a full day).
const HOURS = Array.from({ length: 25 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const MAX_MINUTES = 24 * 60;
const DEFAULT_CARE_TYPES = ["Individual session", "Couples session", "Family session", "Assessment", "Follow-up"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // YYYY-MM-DD
  clinicianName: string;
  currency: string;
  visitFeeMinor: number | null;
  careTypes: { typeOfCare: string; feeMinor: number }[];
  onBooked: (appointment: AppointmentSummary) => void;
};

export function BookAppointmentDialog({ open, onOpenChange, date, clinicianName, currency, visitFeeMinor, careTypes, onBooked }: Props) {
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
            visitFeeMinor={visitFeeMinor}
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
  visitFeeMinor,
  careTypes,
  onBooked,
  onCancel,
}: Omit<Props, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [patient, setPatient] = useState<PatientChoice>(null);
  const [typeOfCare, setTypeOfCare] = useState("");
  const [fee, setFee] = useState("");
  const [virtual, setVirtual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Types used before come first, topped up with common defaults.
  const suggestions = [...careTypes.map((c) => c.typeOfCare), ...DEFAULT_CARE_TYPES]
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, 6);

  function chooseCareType(type: string) {
    setTypeOfCare(type);
    // Pre-fill the fee charged last time for this type of care, else the visit fee from Settings.
    const known = careTypes.find((c) => c.typeOfCare === type)?.feeMinor ?? visitFeeMinor;
    if (known != null && !fee) setFee(moneyInputValue(known, currency));
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
    const durationMinutes = Number(form.get("durationHours")) * 60 + Number(form.get("durationMins"));
    if (durationMinutes < 10) {
      setError("A visit needs to be at least 10 minutes long.");
      return;
    }
    if (durationMinutes > MAX_MINUTES) {
      setError("A visit can be up to 24 hours long.");
      return;
    }
    const input: BookingInput = {
      startsAt: startsAt.toISOString(),
      durationMinutes,
      typeOfCare,
      fee,
      virtual,
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

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Where</legend>
        <div role="radiogroup" aria-label="Where" className="flex flex-wrap gap-2">
          <ChoiceChip single on={!virtual} onClick={() => setVirtual(false)}>
            <MapPin className="size-4" aria-hidden /> In person
          </ChoiceChip>
          <ChoiceChip single on={virtual} onClick={() => setVirtual(true)}>
            <MonitorSmartphone className="size-4" aria-hidden /> Virtual
          </ChoiceChip>
        </div>
        <p className="text-small text-muted-foreground">
          {virtual
            ? "You can clock in and out from anywhere."
            : "You clock in and out at the patient's home, and they sign when you clock out."}
        </p>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Length</legend>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="Hours" name="durationHours" defaultValue="1">
            {HOURS.map((h) => (
              <NativeSelectOption key={h} value={h}>
                {h} {h === 1 ? "hour" : "hours"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Minutes" name="durationMins" defaultValue="0">
            {MINUTES.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {m} min
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <p className="text-small text-muted-foreground">Up to 24 hours, for long nursing visits and aide shifts.</p>
      </fieldset>

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
