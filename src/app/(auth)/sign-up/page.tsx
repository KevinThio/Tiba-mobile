"use client";

import { Building2, Stethoscope, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthHeading } from "@/components/auth-heading";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { LogoUpload } from "@/components/logo-upload";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { authClient } from "@/lib/auth-client";
import { updatePractice } from "@/lib/practice-actions";
import { cn } from "@/lib/utils";

// Better Auth's own messages don't match Tiba's voice, so map its error codes to ours.
const SIGN_UP_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "There's already an account with that email. Try signing in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "There's already an account with that email. Try signing in instead.",
  PASSWORD_TOO_SHORT: "Your password needs at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is a little too long. Please use a shorter one.",
  INVALID_EMAIL: "Add an @, e.g. sam@clinic.com.",
};

// Practice matching (src/lib/practice-join.ts). These name the practice so people can check it.
const PRACTICE_MESSAGES: Record<string, (practice: string) => string> = {
  PRACTICE_TAKEN: (p) =>
    `A practice called “${p}” is already on Tiba. If it's yours, sign in instead. If not, add something to tell it apart, like the town.`,
  PRACTICE_NOT_FOUND: (p) =>
    `We couldn't find a practice called “${p}”. Check the exact name with your practice admin. They need to create the practice on Tiba first.`,
  PRACTICE_HAS_NO_ADMIN: (p) =>
    `“${p}” doesn't have an admin on Tiba yet, so nobody can verify you. Ask your practice to create an admin account first.`,
};

type Role = "clinician" | "admin";
type Country = "US" | "KE";

const CURRENCY_HINT: Record<Country, string> = {
  US: "Prices will show in US dollars ($).",
  KE: "Prices will show in Kenyan shillings (KSh).",
};

const ROLES: { value: Role; title: string; body: string; icon: LucideIcon }[] = [
  { value: "clinician", title: "Clinician", body: "Write notes, sign and invoice your patients.", icon: Stethoscope },
  { value: "admin", title: "Administrator", body: "Run the practice: clinicians, billing, locations.", icon: Building2 },
];

const LOGO_NEEDED = "Admins need to add the practice logo.";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("clinician");
  const [country, setCountry] = useState<Country>("US");
  const [logoMissing, setLogoMissing] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role === "admin" && !logo) {
      setLogoMissing(true);
      return;
    }
    const form = new FormData(event.currentTarget);
    const practiceName = String(form.get("practiceName")).trim();
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      practiceName,
      role,
      country,
    });
    if (error) {
      setPending(false);
      const code = error.code ?? "";
      setError(
        PRACTICE_MESSAGES[code]?.(practiceName) ??
          SIGN_UP_MESSAGES[code] ??
          "We couldn't create your account. Please check your details and try again.",
      );
      return;
    }
    // An admin's logo is saved once the practice exists. If that fails, the account is still fine.
    // Clinicians use their practice's logo. A new clinician goes to the waiting page from "/".
    if (role === "admin" && logo) {
      const saved = await updatePractice({ logo }).catch(() => null);
      if (!saved?.ok) toast.error("Your account is ready, but we couldn't save the logo. You can add it in Settings.");
    }
    router.push("/");
  }

  return (
    <>
      <AuthHeading title="Let's set you up">One account for you and your practice.</AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormField label="Your name" name="name" autoComplete="name" placeholder="e.g. Amina Otieno" required />
        <FormField label="Email" name="email" type="email" autoComplete="email" required />
        <FormField
          label="Password"
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
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Type of account</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ROLES.map(({ value, title, body, icon: Icon }) => {
              const selected = role === value;
              return (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border-[1.5px] bg-card p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring",
                    selected ? "border-primary bg-muted" : "border-input hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={selected}
                    onChange={() => {
                      setRole(value);
                      setLogoMissing(false);
                    }}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="grid gap-0.5">
                    <span className="font-semibold">{title}</span>
                    <span className="text-small text-muted-foreground">{body}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <FormField
          label="Practice name"
          name="practiceName"
          autoComplete="organization"
          hint={
            role === "admin"
              ? "Clinicians join your practice by entering this name when they sign up. You verify each one."
              : "Use the same name your practice admin signed up with. They'll verify your account before you can see patients."
          }
          required
        />
        {role === "admin" && (
        <div className="grid gap-2">
          <Label htmlFor="country">Country</Label>
          <NativeSelect
            id="country"
            name="country"
            className="w-full"
            value={country}
            onChange={(e) => setCountry(e.target.value as Country)}
            aria-describedby="country-hint"
          >
            <NativeSelectOption value="US">United States</NativeSelectOption>
            <NativeSelectOption value="KE">Kenya</NativeSelectOption>
          </NativeSelect>
          <p id="country-hint" className="text-sm text-muted-foreground">
            {CURRENCY_HINT[country]}
          </p>
        </div>
        )}


        {role === "admin" && (
          <LogoUpload
            value={logo}
            onChange={(v) => {
              setLogo(v);
              if (v) setLogoMissing(false);
            }}
            required
            hint="It shows on invoices, notes and agreements. PNG or JPG works best."
            missing={logoMissing ? LOGO_NEEDED : null}
          />
        )}

        {error && <FormAlert>{error}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? "Setting things up…" : "Create account"}
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
