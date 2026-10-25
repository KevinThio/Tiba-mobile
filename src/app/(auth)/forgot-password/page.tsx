"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { requestPasswordResetLink } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<{ field?: "email"; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  // Only the latest request may update the page (an earlier, slower reply mustn't show its error).
  const latest = useRef(0);

  async function send(address: string) {
    const request = ++latest.current;
    setPending(true);
    setError(null);
    const result = await requestPasswordResetLink({ email: address }).catch(() => null);
    if (request !== latest.current) return;
    setPending(false);
    if (!result) {
      setError({ message: "We couldn't send the link just now. Check your connection and try again." });
      return;
    }
    if (!result.ok) {
      setError({ field: result.field, message: result.message });
      return;
    }
    setSentTo(address.trim());
  }

  if (sentTo) {
    return (
      <>
        <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-lg bg-secondary text-primary lg:mx-0">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <AuthHeading title="Check your email">
          We&apos;ve sent a link to {sentTo}. It works once, within the next hour. If it isn&apos;t there, check your spam
          folder.
        </AuthHeading>
        {error && (
          <div className="mb-5">
            <FormAlert>{error.message}</FormAlert>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" nativeButton={false} render={<Link href="/sign-in" />}>
            Back to sign in
          </Button>
          <Button size="lg" variant="outline" disabled={pending} onClick={() => send(sentTo)}>
            {pending ? "Sending…" : "Send it again"}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Forgot your password?">
        Enter the email you use for Tiba and we&apos;ll send you a link to set a new one.
      </AuthHeading>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(email);
        }}
        className="grid gap-5"
        noValidate
      >
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error?.field === "email" || undefined}
          required
        />
        {error && <FormAlert>{error.message}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending || !email.trim()} className="mt-1">
          {pending ? "Sending the link…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-8 text-center text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-primary underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
