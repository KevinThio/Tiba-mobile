"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_TAB_ITEMS,
  NAV_GROUPS,
  TAB_ITEMS,
  isActive,
  type NavGroup,
  type TabItem,
} from "@/components/nav-items";
import { PracticeMark } from "@/components/practice-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

// Navigation lives here (not in props) because icons are components, which can't be
// passed from a server layout to this client component.
const APPS: Record<"clinician" | "admin", { nav: NavGroup[]; tabs: TabItem[]; homeHref: string; accountHref: string }> = {
  clinician: { nav: NAV_GROUPS, tabs: TAB_ITEMS, homeHref: "/appointments", accountHref: "/settings" },
  admin: { nav: ADMIN_NAV_GROUPS, tabs: ADMIN_TAB_ITEMS, homeHref: "/admin", accountHref: "/admin/settings" },
};

export type ShellIdentity = {
  /** Bold line in the side menu footer, e.g. the person's name. */
  title: string;
  /** Second line, e.g. the practice name or "Administrator". */
  subtitle: string;
  /** Name whose initials show when there is no logo. */
  markName: string;
  logoUrl: string | null;
};

/**
 * Signed-in layout for both apps. Desktop (md and up): fixed side menu on the left.
 * Phone: slim top bar, content, and a bottom tab bar within thumb reach.
 * `practiceBrand` swaps the Tiba logo at the top of the side menu for the practice
 * logo and name (the admin app does this).
 */
export function AppShell({
  app,
  user,
  practiceBrand,
  badges = {},
  children,
}: {
  app: "clinician" | "admin";
  /** Counts shown beside menu items, by href (e.g. clinicians waiting to be verified). */
  badges?: Record<string, number>;
  user: ShellIdentity;
  practiceBrand?: { name: string; logoUrl: string | null; caption: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { nav, tabs, homeHref, accountHref } = APPS[app];

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border-subtle bg-card md:flex">
        <div className="px-6 py-6">
          <Link href={homeHref} aria-label="Home" className="block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring">
            {practiceBrand ? (
              <span className="flex min-w-0 items-center gap-3">
                <PracticeMark practiceName={practiceBrand.name} logoUrl={practiceBrand.logoUrl} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{practiceBrand.name}</span>
                  <span className="block truncate text-small text-muted-foreground">{practiceBrand.caption}</span>
                </span>
              </span>
            ) : (
              <Logo />
            )}
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
          {nav.map((group, i) => (
            <div key={group.label ?? i} className={cn(i > 0 && "mt-5")}>
              {group.label && (
                <p className="mb-1 px-4 text-overline font-semibold text-muted-foreground uppercase">{group.label}</p>
              )}
              <ul className="grid gap-1">
                {group.items.map(({ href, label, icon: Icon, exact }) => {
                  const active = isActive(pathname, href, exact);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-11 items-center gap-3 rounded-full px-4 text-base font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                          active ? "bg-secondary text-primary" : "text-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                        <span className="flex-1">{label}</span>
                        {badges[href] ? <CountBadge count={badges[href]} /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-border-subtle p-4">
          <Link
            href={accountHref}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <PracticeMark practiceName={user.markName} logoUrl={user.logoUrl} />
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold">{user.title}</span>
              <span className="block truncate text-sm text-muted-foreground">{user.subtitle}</span>
            </span>
          </Link>
          <SignOutButton iconOnly />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border-subtle bg-card/95 px-5 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Link href={homeHref} aria-label="Home" className="min-w-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring">
            {practiceBrand ? (
              <span className="flex min-w-0 items-center gap-2">
                <PracticeMark practiceName={practiceBrand.name} logoUrl={practiceBrand.logoUrl} className="size-9" />
                <span className="truncate font-semibold">{practiceBrand.name}</span>
              </span>
            ) : (
              <Logo />
            )}
          </Link>
          <Link
            href={accountHref}
            aria-label="Your account"
            className="shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <PracticeMark practiceName={user.title} logoUrl={null} className="size-10 rounded-full" />
          </Link>
        </header>

        <main className="mx-auto w-full max-w-content flex-1 px-5 pt-6 pb-40 md:px-10 md:pt-10 md:pb-28">{children}</main>

        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-up backdrop-blur md:hidden"
        >
          <ul className="mx-auto grid h-[72px] max-w-md grid-cols-4 px-2 pt-1.5 pb-2.5">
            {tabs.map(({ href, label, icon: Icon, exact, also = [] }) => {
              const active = isActive(pathname, href, exact) || also.some((h) => isActive(pathname, h));
              const count = [href, ...also].reduce((n, h) => n + (badges[h] ?? 0), 0);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-full flex-col items-center justify-center gap-1 rounded-md text-xs font-semibold outline-none focus-visible:bg-muted",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                        active && "bg-secondary",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                      {count > 0 && <CountBadge count={count} className="absolute -top-1.5 right-1.5" />}
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

/** Small lilac count, e.g. clinicians waiting to be verified or new reviews. */
function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground",
        className,
      )}
    >
      {count}
    </span>
  );
}
