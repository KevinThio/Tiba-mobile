import { PracticeMark } from "@/components/practice-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { requirePatient } from "@/lib/auth";
import { practiceLogoUrlFor } from "@/lib/practice";

/** The patient portal: the practice at the top, then the patient's conversation with it. Nothing else. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const patient = await requirePatient();
  const logoUrl = await practiceLogoUrlFor(patient.practiceId);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3 px-5">
          <PracticeMark practiceName={patient.practiceName} logoUrl={logoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{patient.practiceName}</p>
            <p className="text-caption text-muted-foreground">Patient portal</p>
          </div>
          <SignOutButton iconOnly to="/patient/sign-in" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+32px)]">{children}</main>
    </div>
  );
}
