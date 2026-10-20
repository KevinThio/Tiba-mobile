"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function TwoFactorPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code: String(form.get("code")) });
    if (error) {
      setPending(false);
      setError("That code didn't work. Codes change every 30 seconds, so try the newest one.");
      return;
    }
    router.push("/");
  }

  return (
    <>
      <AuthHeading title="One more step">Enter the 6-digit code from your authenticator app.</AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="code" className="sr-only">
            6-digit code
          </Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            autoFocus
            required
            className="h-14 text-center font-mono text-2xl tracking-[0.5em] placeholder:tracking-[0.5em]"
          />
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
      </form>
      <p className="mt-8 text-center text-muted-foreground">
        <Link href="/sign-in" className="font-medium text-primary underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
