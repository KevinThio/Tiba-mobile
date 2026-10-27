"use client";

import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
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

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Patient portal sign-in. "/" sends a patient to their portal (and staff to their own app). */
export default function PatientSignInPage() {
  const router = useRouter();
  const [problem, setProblem] = useState<{ field: "email" | "password" | "form"; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!EMAIL_SHAPE.test(email)) return setProblem({ field: "email", message: "Add the email you signed up with, e.g. sam@mail.com." });
    if (!password) return setProblem({ field: "password", message: "Add your password." });

    setPending(true);
    setProblem(null);
    const { error } = await authClient.signIn
      .email({ email, password })
      .catch(() => ({ error: { code: "NETWORK", status: 0 } }));
    if (error) {
      setPending(false);
      return setProblem({
        field: "form",
        message:
          error.status === 429 || error.code === "TOO_MANY_REQUESTS"
            ? "Too many tries. Please wait a minute, then try again."
            : error.code === "INVALID_EMAIL_OR_PASSWORD"
              ? "That email and password don't match. Try again, or reset your password."
              : "We couldn't sign you in just now. Check your connection and try again.",
      });
    }
    router.push("/");
  }

  return (
    <>
      <AuthHeading title="Patient sign in">Message your practice from your patient portal.</AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          icon={Mail}
          error={problem?.field === "email" ? problem.message : null}
          onChange={() => problem?.field === "email" && setProblem(null)}
        />
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            icon={Lock}
            aria-invalid={problem?.field === "password" || undefined}
            onChange={() => problem?.field === "password" && setProblem(null)}
          />
          <div className="flex flex-wrap items-start justify-between gap-2">
            {problem?.field === "password" ? <p className="text-sm text-destructive">{problem.message}</p> : <span />}
            <Link
              href="/forgot-password"
              className="rounded-sm text-small font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        {problem?.field === "form" && <FormAlert>{problem.message}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Signing you in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight aria-hidden />
            </>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-muted-foreground">
        First time here?{" "}
        <Link href="/patient/sign-up" className="font-semibold text-primary underline underline-offset-4">
          Create your patient account
        </Link>
      </p>
      <p className="mt-3 text-center text-small text-muted-foreground">
        Work at a practice?{" "}
        <Link href="/sign-in" className="font-semibold text-primary underline underline-offset-4">
          Staff sign in
        </Link>
      </p>
    </>
  );
}
