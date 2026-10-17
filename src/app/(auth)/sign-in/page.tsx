"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    setPending(false);
    if (error) {
      setError("That email and password don't match. Please try again.");
      return;
    }
    // With 2FA turned on, the password alone is not enough: ask for the code next.
    const needsCode = "twoFactorRedirect" in data && data.twoFactorRedirect;
    router.push(needsCode ? "/sign-in/two-factor" : "/appointments");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl text-primary">Welcome back</CardTitle>
        <CardDescription>Sign in to see today&apos;s appointments.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5">
          <FormField label="Email" name="email" type="email" autoComplete="email" required />
          <FormField label="Password" name="password" type="password" autoComplete="current-password" required />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            New to Tiba?{" "}
            <Link href="/sign-up" className="text-primary underline underline-offset-4">Set up your practice</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
