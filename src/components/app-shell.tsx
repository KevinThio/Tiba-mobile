"use client";

import { CircleUserRound, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { NAV_ITEMS, isActive } from "@/components/nav-items";
import { PracticeDetailsDialog } from "@/components/practice-details-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Clinician = { name: string; practiceName: string; email: string; logoUrl: string | null };

/**
 * Signed-in layout. Desktop (md and up): fixed sidebar on the left.
 * Phone: slim top bar, content, and a bottom tab bar within thumb reach.
 */
export function AppShell({ clinician, children }: { clinician: Clinician; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="px-6 py-6">
          <Link href="/appointments" aria-label="Tiba home">
            <Logo />
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 px-3">
          <ul className="grid gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="grid gap-1 border-t p-4">
          <PracticeIdentity clinician={clinician} />
          <PracticeDetailsDialog
            practiceName={clinician.practiceName}
            logoUrl={clinician.logoUrl}
            triggerClassName="mt-2 w-full justify-start"
          />
          <SignOutButton className="w-full justify-start" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Link href="/appointments" aria-label="Tiba home">
            <Logo />
          </Link>
          <AccountSheet clinician={clinician} />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:px-10 md:py-10">{children}</main>

        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <ul className="mx-auto grid max-w-md grid-cols-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium outline-none focus-visible:bg-muted",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                        active && "bg-secondary",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function AccountSheet({ clinician }: { clinician: Clinician }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Your account" />}>
        <CircleUserRound className="size-6" />
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="sr-only">Your account</SheetTitle>
          <SheetDescription className="sr-only">Your practice details and sign out.</SheetDescription>
          <PracticeIdentity clinician={clinician} showEmail />
        </SheetHeader>
        <div className="grid gap-2 px-4">
          <PracticeDetailsDialog
            practiceName={clinician.practiceName}
            logoUrl={clinician.logoUrl}
            triggerClassName="w-full border border-border"
          />
          <SignOutButton variant="outline" className="w-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Practice logo (or initials) beside the clinician and practice names. */
function PracticeIdentity({ clinician, showEmail = false }: { clinician: Clinician; showEmail?: boolean }) {
  const initials = clinician.practiceName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-card">
        {clinician.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private route, not optimisable
          <img src={clinician.logoUrl} alt="" className="max-h-full max-w-full object-contain p-1" />
        ) : (
          <span className="font-heading text-sm text-primary" aria-hidden>
            {initials}
          </span>
        )}
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-medium">{clinician.name}</span>
        <span className="block truncate text-sm text-muted-foreground">{clinician.practiceName}</span>
        {showEmail && <span className="block truncate text-sm text-muted-foreground">{clinician.email}</span>}
      </span>
    </div>
  );
}

function SignOutButton({ className, variant = "ghost" }: { className?: string; variant?: "ghost" | "outline" }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <Button variant={variant} className={className} onClick={signOut}>
      <LogOut className="size-4" aria-hidden />
      Sign out
    </Button>
  );
}
