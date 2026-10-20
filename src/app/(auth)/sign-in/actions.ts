"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { allow, clientIp } from "@/lib/rate-limit";

/**
 * After a failed sign-in, tells the page whether the email has an account, so it can say
 * "We couldn't find an account for that email" (spec v2) instead of a vague mismatch.
 * Rate-limited per IP so it can't be used to test long lists of emails.
 */
export async function explainSignInFailure(input: { email: string }): Promise<"unknown-email" | "wrong-password" | "slow-down"> {
  if (!allow(`sign-in-check:${await clientIp()}`, 20, 600)) return "slow-down";
  const parsed = z.email().safeParse(String(input.email ?? "").trim().toLowerCase());
  if (!parsed.success) return "unknown-email";
  const [account] = await db
    .select({ id: clinicians.id })
    .from(clinicians)
    .where(eq(sql`lower(${clinicians.email})`, parsed.data))
    .limit(1);
  return account ? "wrong-password" : "unknown-email";
}
