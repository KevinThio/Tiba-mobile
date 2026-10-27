"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * Signs out and returns to a sign-in page (`to`: the staff one by default, the patient portal's
 * for patients). `iconOnly` is the compact version for the side menu footer.
 */
export function SignOutButton({ className, iconOnly = false, to = "/sign-in" }: { className?: string; iconOnly?: boolean; to?: string }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push(to);
  }

  if (iconOnly) {
    return (
      <Button variant="ghost" size="icon-sm" className={className} onClick={signOut} aria-label="Sign out">
        <LogOut className="size-5" aria-hidden />
      </Button>
    );
  }
  return (
    <Button variant="outline" className={className} onClick={signOut}>
      <LogOut className="size-4" aria-hidden />
      Sign out
    </Button>
  );
}
