"use client";

import { ArrowRight, Loader2, Lock, Mail, MessageSquareHeart, PenLine, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-next";
import { explainSignInFailure } from "./actions";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Problem =
  | { kind: "email"; message: string }
  | { kind: "password"; message: string }
  | { kind: "form"; message: string };

/**
 * Sign in (spec v2 section 3 and the prototype). Opens the right app for the account type
 * through "/" (or the page they asked for, via ?next=).
 */
export default function SignInPage() {
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, setPending] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email) return setProblem({ kind: "email", message: "Add the email you use for Tiba." });
    if (!EMAIL_SHAPE.test(email)) return setProblem({ kind: "email", message: "Add an @, e.g. sam@clinic.com." });
    if (!password) return setProblem({ kind: "password", message: "Add your password." });

    setPending(true);
    setProblem(null);
    const { data, error } = await authClient.signIn.email({ email, password, rememberMe: keepSignedIn }).catch(() => ({
      data: null,
      error: { code: "NETWORK", status: 0 },
    }));

    if (error) {
      setProblem(await explain(error.code, error.status, email));
      setPending(false);
      return;
    }
    // With 2FA turned on, the password alone is not enough: ask for the code next.
    const needsCode = data && "twoFactorRedirect" in data && data.twoFactorRedirect;
    // Read at submit time (not useSearchParams) so the page can stay static.
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    router.push(needsCode ? "/sign-in/two-factor" : (next ?? "/"));
  }

  return (
    <>
      <AuthHeading title="Welcome back">Sign in to your practice.</AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          icon={Mail}
          error={problem?.kind === "email" ? problem.message : null}
          onChange={() => problem?.kind === "email" && setProblem(null)}
        />
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            icon={Lock}
            aria-invalid={problem?.kind === "password" || undefined}
            aria-describedby={problem?.kind === "password" ? "password-error" : undefined}
            onChange={() => problem?.kind === "password" && setProblem(null)}
          />
          <div className="flex flex-wrap items-start justify-between gap-2">
            {problem?.kind === "password" ? (
              <p id="password-error" className="text-sm text-destructive">
                {problem.message}
              </p>
            ) : (
              <span />
            )}
            <Link
              href="/forgot-password"
              className="rounded-sm text-small font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3">
          <Switch name="rememberMe" checked={keepSignedIn} onCheckedChange={setKeepSignedIn} />
          <span>Keep me signed in</span>
        </label>

        {problem?.kind === "form" && <FormAlert>{problem.message}</FormAlert>}
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
        New to Tiba?{" "}
        <Link href="/sign-up" className="font-semibold text-primary underline underline-offset-4">
          Create an account
        </Link>
      </p>

      <section aria-labelledby="patients-heading" className="mt-8 grid gap-3 rounded-lg bg-muted p-5">
        <h2 id="patients-heading" className="flex items-center gap-2 font-sans text-base font-semibold text-foreground">
          <MessageSquareHeart className="size-5 text-primary" aria-hidden />
          Are you a patient?
        </h2>
        <p className="text-small text-muted-foreground">
          Tell the practice how your visits went. Only the practice admin reads reviews.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" nativeButton={false} render={<Link href="/review" />}>
            <PenLine aria-hidden />
            Leave a review
          </Button>
          <Button variant="ghost" nativeButton={false} render={<Link href="/reviews" />}>
            <Star aria-hidden />
            Check reviews from patients
          </Button>
        </div>
      </section>
    </>
  );
}

/** Turns Better Auth's error into Tiba copy that says what to do next. */
async function explain(code: string | undefined, status: number | undefined, email: string): Promise<Problem> {
  if (status === 429 || code === "TOO_MANY_REQUESTS") {
    return { kind: "form", message: "Too many tries. Please wait a minute, then try again." };
  }
  if (code === "INVALID_EMAIL_OR_PASSWORD") {
    const why = await explainSignInFailure({ email }).catch(() => "slow-down" as const);
    if (why === "unknown-email") {
      return { kind: "email", message: "We couldn't find an account for that email. Check it, or create one below." };
    }
    if (why === "wrong-password") {
      return { kind: "password", message: "That password doesn't match. Try again, or reset it." };
    }
    return { kind: "form", message: "That email and password don't match. Please try again." };
  }
  if (code === "INVALID_EMAIL") return { kind: "email", message: "Add an @, e.g. sam@clinic.com." };
  return { kind: "form", message: "We couldn't sign you in just now. Check your connection and try again." };
}
