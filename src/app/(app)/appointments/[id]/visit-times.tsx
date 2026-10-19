"use client";

import { Clock, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toDateKey } from "@/lib/format";
import { setVisitTimes } from "../actions";

type Field = "timeIn" | "timeOut";

const toTimeValue = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Record when the visit actually started and ended. These print on the signed note. */
export function VisitTimes({
  appointmentId,
  startsAt,
  initial,
  locked,
}: {
  appointmentId: string;
  startsAt: string;
  initial: { timeIn: string | null; timeOut: string | null };
  locked: boolean;
}) {
  const [times, setTimes] = useState(initial); // what the inputs show
  const [saved, setSaved] = useState(initial); // what the server has
  const [saving, setSaving] = useState<Field | null>(null);
  // One-tap "now" only makes sense on the day of the visit; otherwise type the time.
  const [isVisitDay] = useState(() => toDateKey(new Date()) === toDateKey(new Date(startsAt)));

  async function save(field: Field, iso: string | null) {
    setSaving(field);
    try {
      const result = await setVisitTimes({ appointmentId, [field]: iso });
      if (result.ok) {
        const next = { timeIn: result.timeIn, timeOut: result.timeOut };
        setTimes(next);
        setSaved(next);
      } else {
        setTimes(saved);
        toast.error(result.message);
      }
    } catch {
      toast.error("We couldn't save that time just now. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  // A typed time is taken to be on the day of the visit.
  function fromTimeValue(value: string) {
    if (!value) return null;
    return new Date(`${toDateKey(new Date(startsAt))}T${value}`).toISOString();
  }

  const rows: { field: Field; label: string; icon: typeof LogIn; now: string }[] = [
    { field: "timeIn", label: "Time in", icon: LogIn, now: "Patient's in" },
    { field: "timeOut", label: "Time out", icon: LogOut, now: "Patient's out" },
  ];

  return (
    <section aria-labelledby="visit-times-heading" className="grid gap-3">
      <h2 id="visit-times-heading" className="flex items-center gap-2 text-lg">
        <Clock className="size-5" aria-hidden /> Visit times
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ field, label, icon: Icon, now }) => {
          const inputId = `${field}-input`;
          return (
            <div key={field} className="grid gap-2 rounded-2xl border p-4">
              <label htmlFor={inputId} className="text-sm font-medium">
                {label}
              </label>
              <div className="flex gap-2">
                <Input
                  id={inputId}
                  type="time"
                  value={toTimeValue(times[field])}
                  disabled={locked || saving === field}
                  onChange={(e) => {
                    const iso = fromTimeValue(e.target.value);
                    setTimes((t) => ({ ...t, [field]: iso }));
                  }}
                  onBlur={(e) => {
                    const iso = fromTimeValue(e.target.value);
                    if (iso !== saved[field]) void save(field, iso);
                  }}
                  className="min-w-0 flex-1"
                />
                {!locked && isVisitDay && (
                  <Button
                    type="button"
                    variant={times[field] ? "outline" : "default"}
                    disabled={saving === field}
                    onClick={() => save(field, new Date().toISOString())}
                  >
                    <Icon className="size-4" aria-hidden />
                    {times[field] ? "Now" : now}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {locked
          ? "The note is signed, so these times are locked."
          : isVisitDay
            ? "Tap when the patient arrives and leaves, or type the times. They appear on the signed note."
            : "Type the times the visit started and ended. They appear on the signed note."}
      </p>
    </section>
  );
}
