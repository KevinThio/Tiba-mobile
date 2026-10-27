"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { approvePortalAccount, declinePortalAccount, markReadByPractice, MESSAGE_MAX, sendPracticeReply } from "@/lib/portal";

type Result = { ok: true } | { ok: false; message: string };
const accountId = z.string().min(1).max(100);

/** Confirms a patient's portal request by linking it to one of the practice's patient records. */
export async function confirmPortalRequest(input: { accountId: string; patientId: string }): Promise<Result & { name?: string }> {
  const admin = await requireAdmin();
  const parsed = z.object({ accountId, patientId: z.uuid("Pick the patient record that matches.") }).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick the patient record that matches." };
  const result = await approvePortalAccount(admin.practiceId, parsed.data.accountId, parsed.data.patientId);
  revalidatePath("/", "layout");
  return result;
}

/** Declines a portal request, or turns off a confirmed account. */
export async function turnOffPortalAccount(input: { accountId: string }): Promise<Result> {
  const admin = await requireAdmin();
  if (!accountId.safeParse(input.accountId).success) return { ok: false, message: "Something went wrong. Please refresh the page." };
  const result = await declinePortalAccount(admin.practiceId, input.accountId);
  revalidatePath("/", "layout");
  return result;
}

/** An admin replies to a patient (bound to the conversation on its page). */
export async function replyToPatient(id: string, body: string): Promise<Result> {
  const admin = await requireAdmin();
  const text = z.string().trim().min(1, "Write your reply first.").max(MESSAGE_MAX, "Please keep replies under 2,000 characters.").safeParse(body);
  if (!text.success) return { ok: false, message: text.error.issues[0]?.message ?? "Please check your reply." };
  const sent = await sendPracticeReply(admin, id, text.data);
  if (!sent) return { ok: false, message: "This patient's portal account isn't active, so they can't get messages." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The admin has the conversation on screen: the patient's messages are read. */
export async function markConversationRead(id: string) {
  const admin = await requireAdmin();
  await markReadByPractice(admin.practiceId, id);
  revalidatePath("/", "layout");
}
