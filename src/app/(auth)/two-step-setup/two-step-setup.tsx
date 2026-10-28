"use client";

import { Check, Copy, Download, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { renderSVG } from "uqr";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { PasswordInput } from "@/components/password-input";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Step = { name: "password" } | { name: "scan"; uri: string; backupCodes: string[] } | { name: "codes"; backupCodes: string[] };

/**
 * Turning on two-step sign-in, in three steps: confirm the password (Better Auth makes the
 * authenticator key and backup codes), scan the QR code and enter a code to prove it works (that
 * turns it on), then save the backup codes. The key and codes stay in this browser tab.
 */
export function TwoStepSetup() {
  const [step, setStep] = useState<Step>({ name: "password" });
  return (
    <>
      {step.name === "password" && <PasswordStep onDone={(uri, backupCodes) => setStep({ name: "scan", uri, backupCodes })} />}
      {step.name === "scan" && <ScanStep uri={step.uri} onDone={() => setStep({ name: "codes", backupCodes: step.backupCodes })} />}
      {step.name === "codes" && <CodesStep codes={step.backupCodes} />}
      {step.name !== "codes" && (
        <div className="mt-8 flex items-center justify-center gap-2 text-small text-muted-foreground">
          Not now? <SignOutButton />
        </div>
      )}
    </>
  );
}

function PasswordStep({ onDone }: { onDone: (uri: string, backupCodes: string[]) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (!password) return setError("Add your password.");
    setPending(true);
    setError(null);
    const { data, error } = await authClient.twoFactor
      .enable({ password })
      .catch(() => ({ data: null, error: { code: "NETWORK", status: 0 } }));
    setPending(false);
    if (error || !data || !("totpURI" in data) || !data.totpURI) {
      return setError(
        error?.code === "INVALID_PASSWORD"
          ? "That password isn't right. Try again."
          : error?.status === 429
            ? "Too many tries. Please wait a minute, then try again."
            : "We couldn't start this just now. Check your connection and try again.",
      );
    }
    onDone(data.totpURI, data.backupCodes ?? []);
  }

  return (
    <>
      <AuthHeading title="Protect your practice">
        Admins sign in with two steps: your password, then a code from an app on your phone. It keeps your patients&apos;
        records safe even if someone learns your password.
      </AuthHeading>
      <ol className="mb-6 grid gap-2 rounded-md bg-muted p-4 text-small">
        <li className="flex gap-2">
          <span className="font-semibold text-primary">1.</span> Install an authenticator app on your phone, such as Google
          Authenticator or Microsoft Authenticator (both free).
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-primary">2.</span> Confirm your password below, then scan the code we show you.
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-primary">3.</span> Save your backup codes, in case you lose your phone.
        </li>
      </ol>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="password">Your password</Label>
          <PasswordInput id="password" name="password" autoComplete="current-password" icon={Lock} onChange={() => setError(null)} />
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
          Continue
        </Button>
      </form>
    </>
  );
}

function ScanStep({ uri, onDone }: { uri: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const qr = useMemo(() => `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(uri, { border: 2 }))}`, [uri]);
  // The key, for typing in when the camera can't scan: groups of four letters.
  const key = (new URL(uri).searchParams.get("secret") ?? "").replace(/(.{4})/g, "$1 ").trim();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the app.");
    setPending(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code }).catch(() => ({ error: { code: "NETWORK" } }));
    setPending(false);
    if (error) return setError("That code didn't work. Codes change every 30 seconds, so try the newest one.");
    onDone();
  }

  return (
    <>
      <AuthHeading title="Scan this code">Open your authenticator app, add an account, and scan the code with your phone&apos;s camera.</AuthHeading>
      <div className="mb-6 grid justify-items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made in this tab; next/image can't optimise it */}
        <img src={qr} alt="QR code for your authenticator app" width={208} height={208} className="rounded-md border border-border-subtle bg-white p-2" />
        <details className="w-full rounded-md bg-muted px-4 py-3 text-small">
          <summary className="cursor-pointer font-semibold text-primary">Can&apos;t scan it?</summary>
          <p className="mt-2 text-muted-foreground">Choose &quot;Enter a setup key&quot; in the app, name it Tiba, and type this key:</p>
          <p className="mt-1 font-mono text-base break-all select-all">{key}</p>
        </details>
      </div>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="code">6-digit code from the app</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="000000"
            onChange={() => setError(null)}
            className="h-14 text-center font-mono text-2xl tracking-[0.5em] placeholder:tracking-[0.5em]"
          />
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Turn on two-step sign-in
        </Button>
      </form>
    </>
  );
}

function CodesStep({ codes }: { codes: string[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const text = `Tiba backup codes\nEach code works once, if you can't use your authenticator app.\n\n${codes.join("\n")}\n`;

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "tiba-backup-codes.txt" });
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  }

  return (
    <>
      <AuthHeading title="Two-step sign-in is on">
        Save these backup codes somewhere safe, away from your phone. If you lose your phone, each code lets you sign in once.
      </AuthHeading>
      <ul className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-muted p-4 font-mono text-base" aria-label="Backup codes">
        {codes.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {c}
          </li>
        ))}
      </ul>
      <div className="mb-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={download}>
          <Download aria-hidden />
          Download
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            navigator.clipboard.writeText(text).then(
              () => {
                toast.success("Backup codes copied.");
                setSaved(true);
              },
              () => toast.error("We couldn't copy them. Use Download instead."),
            )
          }
        >
          <Copy aria-hidden />
          Copy
        </Button>
      </div>
      <label className="mb-5 flex items-start gap-3 text-small">
        <Checkbox checked={saved} onCheckedChange={(checked) => setSaved(checked === true)} className="mt-0.5" />
        I&apos;ve saved my backup codes somewhere safe.
      </label>
      <Button
        size="lg"
        className="w-full"
        disabled={!saved}
        onClick={() => {
          router.push("/admin");
          router.refresh();
        }}
      >
        Go to Tiba
      </Button>
    </>
  );
}
