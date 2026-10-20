import { Hourglass, UserX } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth-heading";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { auth, homeFor } from "@/lib/auth";

/**
 * Where clinicians wait until their practice admin verifies them, and where deactivated
 * clinicians land. They have a session but no access to patients until they're active.
 */
export default async function PendingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { user } = session;
  if (homeFor(user) !== "/pending") redirect(homeFor(user));

  const deactivated = user.status === "deactivated";
  const Icon = deactivated ? UserX : Hourglass;

  return (
    <>
      <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-lg bg-accent text-accent-foreground lg:mx-0">
        <Icon className="size-7" aria-hidden />
      </span>
      {deactivated ? (
        <AuthHeading title="Your account is turned off">
          {user.practiceName}&apos;s admin has deactivated your account, so you can&apos;t see patients for now. Your notes
          are kept safe. If this is a mistake, contact your practice admin.
        </AuthHeading>
      ) : (
        <AuthHeading title="Waiting for your admin">
          You&apos;ve asked to join {user.practiceName}. Your practice admin needs to verify your account before you can see
          patients. We&apos;ve let them know.
        </AuthHeading>
      )}
      {!deactivated && (
        <p className="mb-8 rounded-md bg-muted px-4 py-3 text-small text-muted-foreground">
          Signed in as {user.email}. Once you&apos;re verified, we&apos;ll email you and this page opens your appointments.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" nativeButton={false} render={<Link href="/" />}>
          Check again
        </Button>
        <SignOutButton className="h-12" />
      </div>
    </>
  );
}
