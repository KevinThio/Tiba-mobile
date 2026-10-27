"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePatient } from "@/lib/auth";
import { markReadByPatient, MESSAGE_MAX, sendPatientMessage } from "@/lib/portal";
import { allow } from "@/lib/rate-limit";

const messageInput = z.string().trim().min(1, "Write your message first.").max(MESSAGE_MAX, "That message is too long. Please keep it under 2,000 characters.");

/** The patient writes to their practice. Only confirmed (active) accounts can send. */
export async function sendPortalMessage(body: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const patient = await requirePatient();
  if (patient.status !== "active") return { ok: false, message: "Your practice needs to confirm your account before you can send messages." };
  const parsed = messageInput.safeParse(body);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your message." };
  if (!allow(`portal-send:${patient.id}`, 20, 10 * 60)) {
    return { ok: false, message: "You've sent a lot of messages in a short time. Please wait a few minutes." };
  }
  await sendPatientMessage({ id: patient.id, name: patient.name, practiceId: patient.practiceId }, parsed.data);
  revalidatePath("/portal");
  return { ok: true };
}

/** The patient has the conversation on screen: the practice's replies are read. */
export async function markPortalRead() {
  const patient = await requirePatient();
  if (patient.status === "active") await markReadByPatient(patient.id);
}
