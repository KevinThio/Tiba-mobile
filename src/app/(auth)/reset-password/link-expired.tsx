import { LinkIcon } from "lucide-react";
import Link from "next/link";
import { AuthHeading } from "@/components/auth-heading";
import { Button } from "@/components/ui/button";

/** Shown when a reset link is missing, used or older than an hour. */
export function LinkExpired() {
  return (
    <>
      <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-lg bg-accent text-accent-foreground lg:mx-0">
        <LinkIcon className="size-7" aria-hidden />
      </span>
      <AuthHeading title="This link has expired">
        Reset links work once, within an hour of asking. Ask for a new one and use it straight away.
      </AuthHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" nativeButton={false} render={<Link href="/forgot-password" />}>
          Send a new link
        </Button>
        <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
          Back to sign in
        </Button>
      </div>
    </>
  );
}
