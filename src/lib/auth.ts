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

// The device is handed to patients to sign, so sessions end after this much inactivity.
// Each request older than SESSION_REFRESH_SECONDS pushes the expiry forward again.
export const SESSION_IDLE_SECONDS = 30 * 60;
const SESSION_REFRESH_SECONDS = 5 * 60;

export const auth = betterAuth({
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
  // BETTER_AUTH_URL is always trusted. In development, also accept the dev server's
  // other addresses: 127.0.0.1 and the computer's Wi-Fi address (for testing on a phone).
  trustedOrigins:
    process.env.NODE_ENV === "development"
      ? ["http://localhost:*", "http://127.0.0.1:*", "http://192.168.*", "http://10.*"]
      : [],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      practiceName: { type: "string", required: true },
      // Spec v2: picked at sign-up and never changed by the user (see databaseHooks below).
      role: {
        type: ["clinician", "admin"],
        required: true,
        defaultValue: "clinician",
        validator: { input: z.enum(["clinician", "admin"]) },
      },
      country: {
        type: ["US", "KE"],
        required: true,
        defaultValue: "US",
        validator: { input: z.enum(["US", "KE"]) },
      },
    },
  },
  databaseHooks: {
    user: {
      update: {
        // The account type is set once at sign-up. Better Auth merges a hook's returned data
        // into the original, so a field can't be dropped here: refuse the whole update instead.
        // A trigger (drizzle/0005_lock_account_role.sql) also blocks role changes in the database.
        before: async (data) => !("role" in data),
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
  return session.user;
}

/** Where each account type starts after signing in. */
export function homeFor(role: string) {
  return role === "admin" ? "/admin" : "/appointments";
}

/**
 * Returns the signed-in clinician, or sends them to sign in. Admins are sent to their own app,
 * because admins never write notes. Use in every clinician page and Server Action.
 */
export async function requireClinician() {
  const user = await requireAccount();
  if (user.role !== "clinician") redirect(homeFor(user.role));
  return user;
}

/** Returns the signed-in administrator. Clinicians are sent back to their app. Use in every admin page and Server Action. */
export async function requireAdmin() {
  const user = await requireAccount();
  if (user.role !== "admin") redirect(homeFor(user.role));
  return user;
}
