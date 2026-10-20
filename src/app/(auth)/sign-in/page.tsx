"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

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
    router.push(needsCode ? "/sign-in/two-factor" : "/");
  }

  return (
    <>
      <AuthHeading title="Welcome back">Sign in to your practice.</AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormField label="Email" name="email" type="email" autoComplete="email" required />
        <FormField
          label="Password"
          name="password"
          input={<PasswordInput id="password" name="password" autoComplete="current-password" required />}
        />
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? "Signing you in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-8 text-center text-muted-foreground">
        New to Tiba?{" "}
        <Link href="/sign-up" className="font-medium text-primary underline underline-offset-4">
          Set up your practice
        </Link>
      </p>
    </>
  );
}
