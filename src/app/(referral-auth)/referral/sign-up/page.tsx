"use client";

import { Building2, Hospital, Loader2, Lock, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Field = "practiceName" | "name" | "organisation" | "email" | "password" | "form";
type Problem = { field: Field; message: React.ReactNode };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Referral portal sign-up: the practice they refer to, their name and organisation (which the
 * practice's admin checks), and an email and password to sign in with. The account waits until
 * the admin confirms it.
 */
export default function ReferralSignUpPage() {
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, setPending] = useState(false);
  const clear = (field: Field) => problem?.field === field && setProblem(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const practiceName = get("practiceName");
    const name = get("name");
    const organisation = get("organisation");
    const email = get("email");
    const password = String(data.get("password") ?? "");

    if (!practiceName) return setProblem({ field: "practiceName", message: "Add the name of the practice you refer to." });
    if (!name) return setProblem({ field: "name", message: "Add your full name." });
    if (!organisation) return setProblem({ field: "organisation", message: "Add the hospital, clinic or agency you refer from." });
    if (!EMAIL_SHAPE.test(email)) return setProblem({ field: "email", message: "Add an @, e.g. sam@mail.com." });
    if (password.length < 8) return setProblem({ field: "password", message: "Your password needs at least 8 characters." });

    setPending(true);
    setProblem(null);
    // The country is taken from the practice when the account is placed (src/lib/practice-join.ts).
    const { error } = await authClient.signUp
      .email({ name, email, password, practiceName, role: "referrer", country: "US", organisation })
      .catch(() => ({ error: { code: "NETWORK" } }));
    if (error) {
      setPending(false);
      return setProblem(explain(error.code ?? "", practiceName));
    }
    router.push("/");
  }

  return (
    <>
      <AuthHeading title="Create your referral account">
        The practice confirms who you are, then you can send them referrals and documents.
      </AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormField
          label="Practice you refer to"
          name="practiceName"
          icon={Building2}
          hint="The exact name of the practice on Tiba."
          error={problem?.field === "practiceName" ? problem.message : null}
          onChange={() => clear("practiceName")}
        />
        <FormField
          label="Full name"
          name="name"
          autoComplete="name"
          icon={UserRound}
          error={problem?.field === "name" ? problem.message : null}
          onChange={() => clear("name")}
        />
        <FormField
          label="Your organisation"
          name="organisation"
          autoComplete="organization"
          icon={Hospital}
          maxLength={120}
          hint="The hospital, clinic, doctor's office or agency you refer from."
          error={problem?.field === "organisation" ? problem.message : null}
          onChange={() => clear("organisation")}
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          icon={Mail}
          hint="You sign in with it, and we email you when the practice replies."
          error={problem?.field === "email" ? problem.message : null}
          onChange={() => clear("email")}
        />
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            icon={Lock}
            aria-invalid={problem?.field === "password" || undefined}
            onChange={() => clear("password")}
          />
          <p className={problem?.field === "password" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {problem?.field === "password" ? problem.message : "At least 8 characters."}
          </p>
        </div>
        {problem?.field === "form" && <FormAlert>{problem.message}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? "Creating your account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-8 text-center text-muted-foreground">
        Already have an account?{" "}
        <Link href="/referral/sign-in" className="font-semibold text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}

/** Better Auth and practice-matching error codes, in Tiba copy, on the right field. */
function explain(code: string, practice: string): Problem {
  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return {
        field: "email",
        message: (
          <>
            There&apos;s already an account with that email.{" "}
            <Link href="/referral/sign-in" className="font-semibold underline underline-offset-4">
              Sign in instead
            </Link>
          </>
        ),
      };
    case "INVALID_EMAIL":
      return { field: "email", message: "Add an @, e.g. sam@mail.com." };
    case "PASSWORD_TOO_SHORT":
      return { field: "password", message: "Your password needs at least 8 characters." };
    case "PASSWORD_TOO_LONG":
      return { field: "password", message: "That password is a little too long. Please use a shorter one." };
    case "PRACTICE_NOT_FOUND":
      return {
        field: "practiceName",
        message: `We couldn't find a practice called “${practice}”. Check the exact name with the practice.`,
      };
    case "PRACTICE_HAS_NO_ADMIN":
      return {
        field: "practiceName",
        message: `“${practice}” isn't ready for the referral portal yet. Please contact them directly.`,
      };
    case "ORGANISATION_NEEDED":
      return { field: "organisation", message: "Add the hospital, clinic or agency you refer from." };
    case "TOO_MANY_REQUESTS":
      return { field: "form", message: "Too many tries. Please wait a minute, then try again." };
    default:
      return { field: "form", message: "We couldn't create your account just now. Check your connection and try again." };
  }
}
