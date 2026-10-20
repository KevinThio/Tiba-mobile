"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { LinkExpired } from "./link-expired";

const RESET_MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: "Your password needs at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is a little too long. Please use a shorter one.",
};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<"form" | "done" | "expired">("form");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 8) {
      setError("Your password needs at least 8 characters.");
      return;
    }
    if (password !== String(form.get("confirm"))) {
      setError("The two passwords don't match. Type the same password in both boxes.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (!error) {
      setState("done");
      return;
    }
    if (error.code === "INVALID_TOKEN") {
      setState("expired");
      return;
    }
    setError(RESET_MESSAGES[error.code ?? ""] ?? "We couldn't change your password just now. Please try again.");
  }

  if (state === "expired") return <LinkExpired />;

  if (state === "done") {
    return (
      <>
        <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-lg bg-secondary text-primary lg:mx-0">
          <CircleCheck className="size-7" aria-hidden />
        </span>
        <AuthHeading title="Your password is changed">
          Sign in with your new password. For your safety, we&apos;ve signed your account out on every other device.
        </AuthHeading>
        <Button size="lg" className="w-full" nativeButton={false} render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Set a new password">Choose a password you don&apos;t use anywhere else.</AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormField
          label="New password"
          name="password"
          hint="At least 8 characters."
          input={
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              aria-describedby="password-hint"
              required
            />
          }
        />
        <FormField
          label="Type it again"
          name="confirm"
          input={<PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />}
        />
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </>
  );
}
