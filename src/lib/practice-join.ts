import "server-only";
import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUrl } from "@/lib/app-url";
import { clinicians, practices } from "@/db/schema";
import { isCountryCode } from "@/lib/countries";
import { renderEmail, sendEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/notifications";
import { normalisePracticeName } from "@/lib/practice-name";

// Error codes the sign-up page turns into Tiba copy.
export const PRACTICE_TAKEN = "PRACTICE_TAKEN";
export const PRACTICE_NOT_FOUND = "PRACTICE_NOT_FOUND";
export const PRACTICE_HAS_NO_ADMIN = "PRACTICE_HAS_NO_ADMIN";
export const BIRTH_DATE_NEEDED = "BIRTH_DATE_NEEDED";
export const ORGANISATION_NEEDED = "ORGANISATION_NEEDED";

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
    const country = isCountryCode(account.country) ? account.country : "US";
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
  // Patient portal: the date of birth is how the admin checks it's really their patient. The
  // account waits as "pending" until the admin links it to a patient record (any name and date
  // of birth is accepted here, so sign-up never reveals who is a patient of the practice).
  if (account.role === "patient" && !/^\d{4}-\d{2}-\d{2}$/.test(String(account.birthDate ?? ""))) {
    throw new APIError("BAD_REQUEST", { code: BIRTH_DATE_NEEDED, message: "Add your date of birth." });
  }
  // Referral portal: the organisation tells the admin who is referring. Waits like a patient.
  if (account.role === "referrer" && !String(account.organisation ?? "").trim()) {
    throw new APIError("BAD_REQUEST", { code: ORGANISATION_NEEDED, message: "Add your organisation." });
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
  const base = appUrl();
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

/**
 * Tells a practice's admins that someone asked for patient portal access
 * (databaseHooks.user.create.after): a notification in Tiba with the name and date of birth they
 * gave, and an email that names no one (an email can be read by anyone with the inbox).
 */
export async function notifyAdminsOfPortalRequest(accountId: string, practiceId: string) {
  const [account] = await db
    .select({ name: clinicians.name, birthDate: clinicians.birthDate })
    .from(clinicians)
    .where(and(eq(clinicians.id, accountId), eq(clinicians.role, "patient")));
  if (!account) return;
  await notifyAdmins(practiceId, {
    type: "portal_request",
    refId: accountId,
    title: `${account.name} asked for patient portal access`,
    detail: account.birthDate ? `Born ${formatBirthDate(account.birthDate)}. Check it's really them.` : null,
    href: "/admin/messages",
  });
  const admins = await db
    .select({ email: clinicians.email, practiceName: clinicians.practiceName })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "admin")));
  const base = appUrl();
  for (const admin of admins) {
    const body = renderEmail({
      heading: "A patient asked for portal access",
      intro: `Someone asked to join ${admin.practiceName}'s patient portal on Tiba. They can't send or read messages until you confirm it's really your patient.`,
      outro: `Check their details under Messages in Tiba${base ? ` (${base}/admin/messages)` : ""}.`,
    });
    await sendEmail({ to: admin.email, subject: "A patient asked for portal access", ...body }).catch(() => undefined);
  }
}

/**
 * Tells a practice's admins that a referral source asked for referral portal access: a
 * notification in Tiba, and an email that names no one.
 */
export async function notifyAdminsOfReferralRequest(accountId: string, practiceId: string) {
  const [account] = await db
    .select({ name: clinicians.name, organisation: clinicians.organisation })
    .from(clinicians)
    .where(and(eq(clinicians.id, accountId), eq(clinicians.role, "referrer")));
  if (!account) return;
  await notifyAdmins(practiceId, {
    type: "referral_request",
    refId: accountId,
    title: `${account.name} asked for referral portal access`,
    detail: account.organisation ? `From ${account.organisation}. Check you work with them.` : null,
    href: "/admin/referrals",
  });
  const admins = await db
    .select({ email: clinicians.email, practiceName: clinicians.practiceName })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "admin")));
  const base = appUrl();
  for (const admin of admins) {
    const body = renderEmail({
      heading: "A referral source asked to join",
      intro: `Someone asked to send referrals to ${admin.practiceName} through Tiba's referral portal. They can't send messages or documents until you confirm them.`,
      outro: `Check their details under Referral sources in Tiba${base ? ` (${base}/admin/referrals)` : ""}.`,
    });
    await sendEmail({ to: admin.email, subject: "A referral source asked to join", ...body }).catch(() => undefined);
  }
}

const BIRTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatBirthDate = (iso: string) => BIRTH.format(new Date(`${iso}T00:00:00Z`));

/** Tells a clinician their account was activated. Failures are ignored; the activation stands. */
export async function notifyClinicianActivated(clinician: { name: string; email: string; practiceName: string }) {
  const base = appUrl();
  const body = renderEmail({
    heading: "Your account is ready",
    intro: `${clinician.practiceName} has verified your Tiba account, ${clinician.name}. You can sign in and start seeing your appointments.`,
    outro: base ? `Sign in at ${base}/sign-in` : undefined,
  });
  await sendEmail({ to: clinician.email, subject: `You're verified at ${clinician.practiceName}`, ...body }).catch(
    () => undefined,
  );
}
