"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClinician } from "@/lib/auth";
import { recordClock, setVisitVirtual, type ClockResult } from "@/lib/visit-clock";

const position = z
  .object({ latitude: z.number(), longitude: z.number(), accuracy: z.number() })
  .nullable();

const clockInput = z.object({
  appointmentId: z.uuid(),
  event: z.enum(["in", "out"]),
  position,
  patientSignature: z.string().max(500_000).nullable().optional(),
});

/** Clock in or out of one of your visits, now, from where the phone is. */
export async function clockVisit(input: z.input<typeof clockInput>): Promise<ClockResult> {
  const clinician = await requireClinician();
  const parsed = clockInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  const result = await recordClock(clinician, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Mark one of your visits virtual (telehealth) or in person, before you clock in. */
export async function changeVisitMode(input: { appointmentId: string; virtual: boolean }) {
  const clinician = await requireClinician();
  const parsed = z.object({ appointmentId: z.uuid(), virtual: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "We couldn't find that visit." };
  const result = await setVisitVirtual(clinician.id, parsed.data.appointmentId, parsed.data.virtual);
  if (result.ok) revalidatePath(`/appointments/${parsed.data.appointmentId}`);
  return result;
}
