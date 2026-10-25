"use server";

import { and, eq, gt, like, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { clinicians, verifications } from "@/db/schema";
import { auth } from "@/lib/auth";
import { emailConfigured, EmailNotConfiguredError } from "@/lib/email";
import { resetEmailFailed } from "@/lib/reset-email-status";

const RESEND_AFTER_SECONDS = 60;

export type ResetRequestResult =
  | { ok: true }
  | { ok: false; field?: "email"; message: string };

/**
 * Emails a password reset link. Unlike Better Auth's default (which answers the same either
 * way), Tiba tells people when no account uses the email, as the spec's sign-in does
 * ("We couldn't find an account for that email"). One link per account per minute.
 */
const NOT_SET_UP = "Email isn't set up for Tiba yet, so we can't send the link. Ask your practice admin for help.";

export async function requestPasswordResetLink(input: { email: string }): Promise<ResetRequestResult> {
  const parsed = z.email().safeParse(input.email.trim().toLowerCase());
  if (!parsed.success) return { ok: false, field: "email", message: "Add an @, e.g. sam@clinic.com." };
  const email = parsed.data;

  const [account] = await db
    .select({ id: clinicians.id })
    .from(clinicians)
    .where(eq(sql`lower(${clinicians.email})`, email));
  if (!account) {
    return {
      ok: false,
      field: "email",
      message: "We couldn't find an account for that email. Check it, or create an account.",
    };
  }

  const [recent] = await db
    .select({ id: verifications.id })
    .from(verifications)
    .where(
      and(
        eq(verifications.value, account.id),
        like(verifications.identifier, "reset-password:%"),
        gt(verifications.createdAt, sql`now() - make_interval(secs => ${RESEND_AFTER_SECONDS})`),
      ),
    )
    .limit(1);
  if (recent) {
    return {
      ok: false,
      message: "We sent you a link a moment ago. Check your inbox and spam folder, or try again in a minute.",
    };
  }

  if (!emailConfigured()) {
    return { ok: false, message: NOT_SET_UP };
  }

  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof EmailNotConfiguredError
          ? NOT_SET_UP
          : "We couldn't send the link just now. Check your connection and try again.",
    };
  }
  if (resetEmailFailed(account.id)) {
    return { ok: false, message: "We couldn't send the link just now. Please try again in a few minutes." };
  }
  return { ok: true };
}
