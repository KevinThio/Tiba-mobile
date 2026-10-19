import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
    minPasswordLength: 12,
  },
  user: {
    additionalFields: {
      practiceName: { type: "string", required: true },
    },
  },
  session: {
    expiresIn: SESSION_IDLE_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
  },
  // nextCookies must stay last so Server Actions can set auth cookies.
  plugins: [twoFactor({ issuer: "Tiba" }), nextCookies()],
});

/** Returns the signed-in clinician, or sends them to sign in. Use in every page and Server Action. */
export async function requireClinician() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session.user;
}
