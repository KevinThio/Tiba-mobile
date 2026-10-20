import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ADMIN_MORE_ITEMS } from "@/components/nav-items";
import { PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/auth";

/** Phone only in the prototype: every admin screen that isn't a tab. Works on desktop too. */
export default async function AdminMorePage() {
  const { practiceName } = await requireAdmin();
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader overline={practiceName} title="More" />
      <nav aria-label="More" className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
        {ADMIN_MORE_ITEMS.map(({ href, label, meta, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 outline-none first:rounded-t-lg last:rounded-b-lg last:border-b-0 focus-visible:ring-3 focus-visible:ring-ring"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{label}</span>
              <span className="block truncate text-small text-muted-foreground">{meta}</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </nav>
      <SignOutButton className="w-full sm:w-fit" />
    </div>
  );
}
