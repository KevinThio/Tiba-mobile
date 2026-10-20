"use client";

import { Building2, Check, Loader2, Lock, Mail, Stethoscope, type LucideIcon } from "lucide-react";
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

type Role = "clinician" | "admin";
type Country = "US" | "KE";
type Field = "name" | "email" | "password" | "practiceName" | "logo";
type Problem = { field: Field | "form"; message: React.ReactNode };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const CURRENCY_HINT: Record<Country, string> = {
  US: "Prices will show in US dollars ($).",
  KE: "Prices will show in Kenyan shillings (KSh).",
};

const ROLES: { value: Role; title: string; body: string; icon: LucideIcon }[] = [
  { value: "clinician", title: "Clinician", body: "Write notes, sign and invoice your patients.", icon: Stethoscope },
  { value: "admin", title: "Administrator", body: "Run the practice: clinicians, billing, locations.", icon: Building2 },
];

/**
 * Create account (spec v2 section 3, "Sign up" and "Joining a practice"). An administrator
 * creates the practice; a clinician joins one by its name and waits for the admin to verify them.
 */
export default function SignUpPage() {
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, setPending] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("clinician");
  const [country, setCountry] = useState<Country>("US");
  const [password, setPassword] = useState("");

  const errorFor = (field: Field) => (problem?.field === field ? problem.message : null);
  const clear = (field: Field) => {
    if (problem?.field === field) setProblem(null);
  };

  function fail(next: Problem) {
    setProblem(next);
    // Move to the field that needs attention (the logo picker's section for a missing logo).
    if (next.field !== "form") {
      const id = next.field === "logo" ? "logo-section" : next.field;
      requestAnimationFrame(() => document.getElementById(id)?.focus());
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const practiceName = String(form.get("practiceName") ?? "").trim();

    if (!name) return fail({ field: "name", message: "Add your name." });
    if (!email) return fail({ field: "email", message: "Add your email." });
    if (!EMAIL_SHAPE.test(email)) return fail({ field: "email", message: "Add an @, e.g. sam@clinic.com." });
    if (password.length < MIN_PASSWORD) {
      return fail({ field: "password", message: "Your password needs at least 8 characters." });
    }
    if (!practiceName) {
      return fail({
        field: "practiceName",
        message: role === "admin" ? "Add your practice name." : "Add the name of the practice you're joining.",
      });
    }
    if (role === "admin" && !logo) return fail({ field: "logo", message: "Admins need to add the practice logo." });

    setPending(true);
    setProblem(null);
    const { error } = await authClient.signUp
      .email({ name, email, password, practiceName, role, country })
      .catch(() => ({ error: { code: "NETWORK" } }));
    if (error) {
      setPending(false);
      return fail(explain(error.code ?? "", practiceName));
    }
    // An admin's logo is saved once the practice exists. If that fails, the account is still fine.
    // Clinicians use their practice's logo. "/" sends admins to their app and new clinicians to
    // the waiting page until their admin verifies them.
    if (role === "admin" && logo) {
      const saved = await updatePractice({ logo }).catch(() => null);
      if (!saved?.ok) toast.error("Your account is ready, but we couldn't save the logo. You can add it in Settings.");
    }
    router.push("/");
  }

  const longEnough = password.length >= MIN_PASSWORD;
  const passwordError = errorFor("password");

  return (
    <>
      <AuthHeading title="Let's set you up">One account for you and your practice.</AuthHeading>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <FormField
          label="Your name"
          name="name"
          autoComplete="name"
          placeholder="e.g. Amina Otieno"
          error={errorFor("name")}
          onChange={() => clear("name")}
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          icon={Mail}
          error={errorFor("email")}
          onChange={() => clear("email")}
        />
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            icon={Lock}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clear("password");
            }}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby="password-hint"
          />
          <p
            id="password-hint"
            className={cn(
              "flex items-center gap-1.5 text-sm",
              passwordError ? "text-destructive" : longEnough ? "text-success-foreground" : "text-muted-foreground",
            )}
          >
            {passwordError ?? (
              <>
                {longEnough && <Check className="size-4" aria-hidden />}
                At least 8 characters.
              </>
            )}
          </p>
        </div>

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
                      setProblem(null);
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
          label={role === "admin" ? "Practice name" : "Practice you're joining"}
          name="practiceName"
          autoComplete="organization"
          icon={Building2}
          error={errorFor("practiceName")}
          onChange={() => clear("practiceName")}
          hint={
            role === "admin"
              ? "Clinicians join your practice by entering this name when they sign up. You verify each one."
              : "Use the same name your practice admin signed up with. They'll verify your account before you can see patients."
          }
        />

        {role === "admin" && (
          <>
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
            <div id="logo-section" tabIndex={-1} className="rounded-md outline-none">
              <LogoUpload
                value={logo}
                onChange={(v) => {
                  setLogo(v);
                  if (v) clear("logo");
                }}
                required
                hint="It shows on invoices, notes and agreements. PNG or JPG works best."
                missing={problem?.field === "logo" ? String(problem.message) : null}
              />
            </div>
          </>
        )}

        {problem?.field === "form" && <FormAlert>{problem.message}</FormAlert>}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Setting things up…
            </>
          ) : (
            "Create account"
          )}
        </Button>
        {role === "clinician" && (
          <p className="text-center text-small text-muted-foreground">
            Your practice admin gets an email and verifies you. Until then, you&apos;ll see a waiting page.
          </p>
        )}
      </form>

      <p className="mt-8 text-center text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}

/** Turns Better Auth and practice-matching error codes into Tiba copy, on the right field. */
function explain(code: string, practice: string): Problem {
  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return {
        field: "email",
        message: (
          <>
            There&apos;s already an account with that email.{" "}
            <Link href="/sign-in" className="font-semibold underline underline-offset-4">
              Sign in instead
            </Link>
          </>
        ),
      };
    case "INVALID_EMAIL":
      return { field: "email", message: "Add an @, e.g. sam@clinic.com." };
    case "PASSWORD_TOO_SHORT":
      return { field: "password", message: "Your password needs at least 8 characters." };
    case "PASSWORD_TOO_LONG":
      return { field: "password", message: "That password is a little too long. Please use a shorter one." };
    // Practice matching (src/lib/practice-join.ts). These name the practice so people can check it.
    case "PRACTICE_TAKEN":
      return {
        field: "practiceName",
        message: `A practice called “${practice}” is already on Tiba. If it's yours, sign in instead. If not, add something to tell it apart, like the town.`,
      };
    case "PRACTICE_NOT_FOUND":
      return {
        field: "practiceName",
        message: `We couldn't find a practice called “${practice}”. Check the exact name with your practice admin. They need to create the practice on Tiba first.`,
      };
    case "PRACTICE_HAS_NO_ADMIN":
      return {
        field: "practiceName",
        message: `“${practice}” doesn't have an admin on Tiba yet, so nobody can verify you. Ask your practice to create an admin account first.`,
      };
    case "TOO_MANY_REQUESTS":
      return { field: "form", message: "Too many tries. Please wait a minute, then try again." };
    default:
      return { field: "form", message: "We couldn't create your account just now. Check your connection and try again." };
  }
}
