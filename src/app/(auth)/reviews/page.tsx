import { Lock } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth-heading";
import { Button } from "@/components/ui/button";
import { auth, homeFor } from "@/lib/auth";

/**
 * "Check reviews from patients" on the sign-in page. Admins go to their reviews; anyone
 * else is told only the practice admin can see them (spec v2 section 3).
 */
export default async function CheckReviewsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?next=/reviews");
  if (session.user.role === "admin") redirect("/admin/reviews");

  return (
    <>
      <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-lg bg-accent text-accent-foreground lg:mx-0">
        <Lock className="size-7" aria-hidden />
      </span>
      <AuthHeading title="Only your admin can see reviews">
        Patient reviews go privately to {session.user.practiceName}&apos;s admin. Clinicians can&apos;t read them, so
        patients can speak freely.
      </AuthHeading>
      <Button size="lg" className="w-full" nativeButton={false} render={<Link href={homeFor(session.user)} />}>
        Back to Tiba
      </Button>
    </>
  );
}
