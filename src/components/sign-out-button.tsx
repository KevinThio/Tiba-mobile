"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Signs out and returns to the sign-in page. `iconOnly` is the compact version for the side menu footer. */
export function SignOutButton({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
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
