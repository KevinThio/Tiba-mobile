"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

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
    setPending(false);
    if (error) {
      setError(SIGN_UP_MESSAGES[error.code ?? ""] ?? "We couldn't create your account. Please check your details and try again.");
      return;
    }
    router.push("/appointments");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl text-primary">Let&apos;s set up your practice</CardTitle>
        <CardDescription>It takes a minute. Everything stays private to you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5">
          <FormField label="Your name" name="name" autoComplete="name" required />
          <FormField label="Practice name" name="practiceName" autoComplete="organization" required />
          <FormField label="Email" name="email" type="email" autoComplete="email" required />
          <FormField
            label="Password (at least 12 characters)"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Setting up…" : "Create my account"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary underline underline-offset-4">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
