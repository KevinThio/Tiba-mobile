"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

/**
 * The second sign-in step: the 6-digit code from the authenticator app, or one of the backup codes
 * (each works once). "Don't ask again on this device" trusts this browser for 30 days; it's off by
 * default because clinicians hand their device to patients.
 */
export default function TwoFactorPage() {
  const router = useRouter();
  const [backup, setBackup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!code) return setError(backup ? "Enter one of your backup codes." : "Enter the 6-digit code from your app.");
    setPending(true);
    setError(null);
    const verify = backup ? authClient.twoFactor.verifyBackupCode : authClient.twoFactor.verifyTotp;
    const { error } = await verify({ code, trustDevice }).catch(() => ({ error: { code: "NETWORK", status: 0 } }));
    if (error) {
      setPending(false);
      setError(
        error.status === 401 || error.code === "INVALID_TWO_FACTOR_COOKIE"
          ? "This sign-in timed out. Go back and sign in again."
          : backup
            ? "That backup code didn't work. Check it, or try another one. Each code works once."
            : "That code didn't work. Codes change every 30 seconds, so try the newest one.",
      );
      return;
    }
    router.push("/");
  }

  return (
    <>
      <AuthHeading title="One more step">
        {backup ? "Enter one of the backup codes you saved when you turned on two-step sign-in." : "Enter the 6-digit code from your authenticator app."}
      </AuthHeading>
      <form key={backup ? "backup" : "app"} onSubmit={onSubmit} className="grid gap-5" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="code" className="sr-only">
            {backup ? "Backup code" : "6-digit code"}
          </Label>
          <Input
            id="code"
            name="code"
            inputMode={backup ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={backup ? 24 : 7}
            placeholder={backup ? "xxxxx-xxxxx" : "000000"}
            autoFocus
            onChange={() => setError(null)}
            className="h-14 text-center font-mono text-2xl tracking-[0.3em] placeholder:tracking-[0.3em]"
          />
        </div>
        <label className="flex items-start gap-3 text-small">
          <Checkbox checked={trustDevice} onCheckedChange={(checked) => setTrustDevice(checked === true)} className="mt-0.5" />
          <span>
            Don&apos;t ask again on this device for 30 days
            <span className="block text-muted-foreground">Only on your own computer or phone, never a shared one.</span>
          </span>
        </label>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
      </form>
      <p className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            setBackup((b) => !b);
            setError(null);
          }}
          className="rounded-sm font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          {backup ? "Use the code from my app" : "Lost your phone? Use a backup code"}
        </button>
      </p>
      <p className="mt-4 text-center text-muted-foreground">
        <Link href="/sign-in" className="font-medium text-primary underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
