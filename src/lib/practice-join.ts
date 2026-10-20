import "server-only";
import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, practices } from "@/db/schema";
import { renderEmail, sendEmail } from "@/lib/email";
import { normalisePracticeName } from "@/lib/practice-name";

// Error codes the sign-up page turns into Tiba copy.
export const PRACTICE_TAKEN = "PRACTICE_TAKEN";
export const PRACTICE_NOT_FOUND = "PRACTICE_NOT_FOUND";
export const PRACTICE_HAS_NO_ADMIN = "PRACTICE_HAS_NO_ADMIN";

type NewAccount = Record<string, unknown>;

/**
 * Runs before Better Auth creates an account (databaseHooks.user.create.before).
 * - An administrator creates a new practice and is active straight away.
 * - A clinician joins the practice whose name matches and waits as "pending" until
 *   that practice's admin activates them. They take the practice's name and country.
 * Returns the fields to store on the new account.
 */
export async function placeNewAccount(account: NewAccount) {
  const name = String(account.practiceName ?? "").trim();
  const nameKey = normalisePracticeName(name);
  const [existing] = await db.select().from(practices).where(eq(practices.nameKey, nameKey));

  if (account.role === "admin") {
    if (existing) {
      throw new APIError("BAD_REQUEST", {
        code: PRACTICE_TAKEN,
        message: "A practice with that name is already on Tiba.",
      });
    }
    const country = account.country === "KE" ? "KE" : "US";
    // If creating the account fails after this, the empty practice is left behind;
    // Better Auth checks the email before running this hook, so that is rare.
    const [practice] = await db.insert(practices).values({ name, nameKey, country }).returning();
    return { practiceId: practice.id, practiceName: practice.name, country, status: "active" as const };
  }

  if (!existing) {
    throw new APIError("BAD_REQUEST", {
      code: PRACTICE_NOT_FOUND,
      message: "No practice with that name is on Tiba yet.",
    });
  }
  const [admin] = await db
    .select({ id: clinicians.id })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, existing.id), eq(clinicians.role, "admin")))
    .limit(1);
  if (!admin) {
    throw new APIError("BAD_REQUEST", {
      code: PRACTICE_HAS_NO_ADMIN,
      message: "That practice has no admin to verify new clinicians.",
    });
  }
  return {
    practiceId: existing.id,
    practiceName: existing.name,
    country: existing.country,
    status: "pending" as const,
  };
}

/**
 * Tells a practice's admins that a clinician is waiting to be verified
 * (databaseHooks.user.create.after). Email failures never undo the sign-up.
 */
export async function notifyAdminsOfNewClinician(account: { name: string; email: string; practiceId: string; role: string }) {
  if (account.role !== "clinician") return;
  const admins = await db
    .select({ email: clinicians.email, practiceName: clinicians.practiceName })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, account.practiceId), eq(clinicians.role, "admin")));
  const base = process.env.BETTER_AUTH_URL ?? "";
  for (const admin of admins) {
    const body = renderEmail({
      heading: "A clinician is waiting for you",
      intro: `${account.name} (${account.email}) created a Tiba account to join ${admin.practiceName}. They can't see any patients until you verify them.`,
      outro: `If you know them, activate their account under Clinicians in Tiba${base ? ` (${base}/admin/clinicians)` : ""}. If you don't, leave it inactive.`,
    });
    await sendEmail({ to: admin.email, subject: `${account.name} wants to join ${admin.practiceName} on Tiba`, ...body }).catch(
      () => undefined,
    );
  }
}

/** Tells a clinician their account was activated. Failures are ignored; the activation stands. */
export async function notifyClinicianActivated(clinician: { name: string; email: string; practiceName: string }) {
  const base = process.env.BETTER_AUTH_URL ?? "";
  const body = renderEmail({
    heading: "Your account is ready",
    intro: `${clinician.practiceName} has verified your Tiba account, ${clinician.name}. You can sign in and start seeing your appointments.`,
    outro: base ? `Sign in at ${base}/sign-in` : undefined,
  });
  await sendEmail({ to: clinician.email, subject: `You're verified at ${clinician.practiceName}`, ...body }).catch(
    () => undefined,
  );
}
