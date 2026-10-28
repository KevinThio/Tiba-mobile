"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { approveReferralAccount, declinePortalAccount, markReadByPractice, MESSAGE_MAX, sendPracticeReply } from "@/lib/portal";
import { REFERRAL_LIMITS } from "@/lib/referral-status";
import { decideReferral } from "@/lib/referrals";

type Result = { ok: true } | { ok: false; message: string };
const accountId = z.string().min(1).max(100);

/** Confirms a referral source: they can now send the practice messages and documents. */
export async function confirmReferralRequest(input: { accountId: string }): Promise<Result> {
  const admin = await requireAdmin();
  if (!accountId.safeParse(input.accountId).success) return { ok: false, message: "Something went wrong. Please refresh the page." };
  const result = await approveReferralAccount(admin.practiceId, input.accountId);
  revalidatePath("/", "layout");
  return result;
}

/** Declines a referral source's request, or turns off a confirmed account. */
export async function turnOffReferralAccount(input: { accountId: string }): Promise<Result> {
  const admin = await requireAdmin();
  if (!accountId.safeParse(input.accountId).success) return { ok: false, message: "Something went wrong. Please refresh the page." };
  const result = await declinePortalAccount(admin.practiceId, input.accountId, "referrer");
  revalidatePath("/", "layout");
  return result;
}

/** An admin replies to a referral source (bound to the conversation on its page). */
export async function replyToReferrer(id: string, body: string): Promise<Result> {
  const admin = await requireAdmin();
  const text = z.string().trim().min(1, "Write your reply first.").max(MESSAGE_MAX, "Please keep replies under 2,000 characters.").safeParse(body);
  if (!text.success) return { ok: false, message: text.error.issues[0]?.message ?? "Please check your reply." };
  const sent = await sendPracticeReply(admin, id, text.data, "referrer");
  if (!sent) return { ok: false, message: "This referral source's account isn't active, so they can't get messages." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The admin has the conversation on screen: the referral source's messages are read. */
export async function markReferralRead(id: string) {
  const admin = await requireAdmin();
  await markReadByPractice(admin.practiceId, id, "referrer");
  revalidatePath("/", "layout");
}

/** Accepts or declines a waiting referral, with an optional note the referral source sees. */
export async function decideReferralRequest(input: { referralId: string; decision: "accepted" | "declined"; note: string }): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      referralId: z.uuid(),
      decision: z.enum(["accepted", "declined"]),
      note: z.string().trim().max(REFERRAL_LIMITS.decisionNote, "Please keep the note under 500 characters."),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues.find((i) => i.path[0] === "note")?.message ?? "Something went wrong. Please refresh the page." };
  const result = await decideReferral(admin, parsed.data.referralId, parsed.data.decision, parsed.data.note || null);
  revalidatePath("/", "layout");
  return result;
}
