"use client";

import { MessageSquareHeart, PenLine, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-next";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setPending(false);
      setError(
        error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "That email and password don't match. Please try again."
          : "We couldn't sign you in just now. Please refresh the page and try again.",
      );
      return;
    }
    // With 2FA turned on, the password alone is not enough: ask for the code next.
    const needsCode = "twoFactorRedirect" in data && data.twoFactorRedirect;
    // Read at submit time (not useSearchParams) so the page can stay static.
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    router.push(needsCode ? "/sign-in/two-factor" : (next ?? "/"));
  }

  return (
    <>
      <AuthHeading title="Welcome back">Sign in to your practice.</AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormField label="Email" name="email" type="email" autoComplete="email" required />
        <div className="grid gap-2">
          <FormField
            label="Password"
            name="password"
            input={<PasswordInput id="password" name="password" autoComplete="current-password" required />}
          />
          <Link
            href="/forgot-password"
            className="w-fit justify-self-end rounded-sm text-small font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring"
          >
            Forgot password?
          </Link>
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? "Signing you in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-8 text-center text-muted-foreground">
        New to Tiba?{" "}
        <Link href="/sign-up" className="font-medium text-primary underline underline-offset-4">
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
