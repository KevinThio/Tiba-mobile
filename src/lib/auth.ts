import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { isCountryCode } from "@/lib/countries";
import { renderEmail, sendEmail } from "@/lib/email";
import { notifyAdminsOfNewClinician, placeNewAccount } from "@/lib/practice-join";

// The device is handed to patients to sign, so sessions end after this much inactivity.
// Each request older than SESSION_REFRESH_SECONDS pushes the expiry forward again.
export const SESSION_IDLE_SECONDS = 30 * 60;
const SESSION_REFRESH_SECONDS = 5 * 60;
/** How long a password reset link works. */
export const RESET_LINK_SECONDS = 60 * 60;

const PROTECTED_FIELDS = ["role", "status", "practiceId", "practiceName", "country"];

export const auth = betterAuth({
  // The public address (BETTER_AUTH_URL, or Render's address until a domain is connected).
  baseURL: appUrl() || undefined,
  appName: "Tiba",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.clinicians,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      twoFactor: schema.twoFactors,
    },
  }),
  // The public address is always trusted. In development, also accept the dev server's
  // other addresses: 127.0.0.1 and the computer's Wi-Fi address (for testing on a phone).
  trustedOrigins:
    process.env.NODE_ENV === "development"
      ? ["http://localhost:*", "http://127.0.0.1:*", "http://192.168.*", "http://10.*"]
      : [],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Forgot password: /forgot-password asks for the email, this sends the link, and the
    // link opens /reset-password. Links work once, for an hour. Resetting signs the account
    // out everywhere, because a forgotten password may mean someone else had it.
    resetPasswordTokenExpiresIn: RESET_LINK_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const body = renderEmail({
        heading: "Set a new password",
        intro: `Someone asked to reset the password for the Tiba account ${user.email}. If it was you, use the button below. It works once, within the next hour.`,
        action: { label: "Set a new password", url },
        outro: "If you didn't ask for this, you can ignore this email. Your password stays the same.",
      });
      await sendEmail({ to: user.email, subject: "Reset your Tiba password", ...body });
    },
  },
  user: {
    additionalFields: {
      // At sign-up: the practice to create (admin) or join (clinician). Afterwards a copy
      // of the practice's name; see placeNewAccount in src/lib/practice-join.ts.
      practiceName: { type: "string", required: true },
      // Set by placeNewAccount, never by the person signing up.
      practiceId: { type: "string", required: false, input: false },
      status: { type: ["pending", "active", "deactivated"], required: false, input: false, defaultValue: "pending" },
      // Spec v2: picked at sign-up and never changed by the user (see databaseHooks below).
      role: {
        type: ["clinician", "admin"],
        required: true,
        defaultValue: "clinician",
        validator: { input: z.enum(["clinician", "admin"]) },
      },
      // ISO 3166-1 code of the practice's country (any country; sets the currency).
      country: {
        type: "string",
        required: true,
        defaultValue: "US",
        validator: { input: z.string().refine(isCountryCode, "Pick your country from the list.") },
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Create the practice (admin) or join one and wait for verification (clinician).
        // Throws an APIError with a code the sign-up page explains.
        before: async (user) => ({ data: { ...user, ...(await placeNewAccount(user)) } }),
        after: async (user) => {
          await notifyAdminsOfNewClinician({
            name: user.name,
            email: user.email,
            practiceId: String(user.practiceId),
            role: String(user.role),
          }).catch(() => undefined);
        },
      },
      update: {
        // Account type, verification status and practice are only changed by Tiba's own
        // code (sign-up, the admin's Clinicians screen, updatePractice), never through
        // Better Auth's update-user endpoint. Better Auth merges a hook's returned data
        // into the original, so fields can't be dropped here: refuse the whole update.
        // A trigger (drizzle/0005_lock_account_role.sql) also blocks role changes.
        before: async (data) => !PROTECTED_FIELDS.some((field) => field in data),
      },
    },
  },
  session: {
    expiresIn: SESSION_IDLE_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
  },
  // nextCookies must stay last so Server Actions can set auth cookies.
  plugins: [twoFactor({ issuer: "Tiba" }), nextCookies()],
});

export type Role = "clinician" | "admin";

/** The signed-in account of either type, or a redirect to sign in. Only for things both apps share, like practice details. */
export async function requireAccount() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { practiceId, status } = session.user;
  // Better Auth types these as optional because people can't supply them at sign-up;
  // the database requires a practice for every account.
  if (!practiceId) throw new Error("Account has no practice.");
  return { ...session.user, practiceId, status: status ?? "pending" };
}

/**
 * Where an account starts after signing in: admins in the admin app, active clinicians on
 * Appointments, and clinicians not yet verified (or deactivated) on the waiting page.
 */
export function homeFor(user: { role: string; status?: string | null }) {
  if (user.role === "admin") return "/admin";
  return user.status === "active" ? "/appointments" : "/pending";
}

/**
 * Returns the signed-in, verified clinician, or sends them to sign in. Admins go to their own
 * app (admins never write notes); clinicians the admin hasn't activated, or has deactivated,
 * go to the waiting page. Use in every clinician page and Server Action.
 */
export async function requireClinician() {
  const user = await requireAccount();
  if (user.role !== "clinician" || user.status !== "active") redirect(homeFor(user));
  return user;
}

/** Returns the signed-in administrator. Clinicians are sent back to their app. Use in every admin page and Server Action. */
export async function requireAdmin() {
  const user = await requireAccount();
  if (user.role !== "admin") redirect(homeFor(user));
  return user;
}
