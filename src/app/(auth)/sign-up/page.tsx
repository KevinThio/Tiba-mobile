"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { LogoUpload } from "@/components/logo-upload";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { updatePractice } from "@/lib/practice-actions";

// Better Auth's own messages don't match Tiba's voice, so map its error codes to ours.
const SIGN_UP_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "There's already an account with that email. Try signing in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "There's already an account with that email. Try signing in instead.",
  PASSWORD_TOO_SHORT: "Your password needs at least 12 characters.",
  PASSWORD_TOO_LONG: "That password is a little too long. Please use a shorter one.",
  INVALID_EMAIL: "That email address doesn't look quite right. Please check it.",
};

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      practiceName: String(form.get("practiceName")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setPending(false);
      setError(SIGN_UP_MESSAGES[error.code ?? ""] ?? "We couldn't create your account. Please check your details and try again.");
      return;
    }
    // The logo is saved once the account exists. If that fails, the account is still fine.
    if (logo) {
      const saved = await updatePractice({ logo }).catch(() => null);
      if (!saved?.ok) toast.error("Your account is ready, but we couldn't save the logo. You can add it from your account.");
    }
    router.push("/appointments");
  }

  return (
    <>
      <AuthHeading title="Let's set up your practice">It takes a minute. Everything stays private to you.</AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormField label="Your name" name="name" autoComplete="name" placeholder="e.g. Amina Otieno" required />
        <FormField label="Practice name" name="practiceName" autoComplete="organization" required />
        <LogoUpload value={logo} onChange={setLogo} />
        <FormField label="Email" name="email" type="email" autoComplete="email" required />
        <FormField
          label="Password"
          name="password"
          hint="At least 12 characters. A short sentence works well."
          input={
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              aria-describedby="password-hint"
              required
            />
          }
        />
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? "Setting things up…" : "Create my account"}
        </Button>
      </form>
      <p className="mt-8 text-center text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
