import { PageHeader } from "@/components/page-header";
import { PracticeDetailsDialog } from "@/components/practice-details-dialog";
import { PracticeMark } from "@/components/practice-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/auth";
import { practiceLogoUrlFor } from "@/lib/practice";

const COUNTRY = {
  US: { name: "United States", currency: "Invoices, billing and agreements show US dollars ($)." },
  KE: { name: "Kenya", currency: "Invoices, billing and agreements show Kenyan shillings (KSh)." },
} as const;

export default async function AdminSettingsPage() {
  const { name, practiceName, practiceId, country } = await requireAdmin();
  const logoUrl = await practiceLogoUrlFor(practiceId);
  const place = COUNTRY[country as keyof typeof COUNTRY] ?? COUNTRY.US;

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader overline="Your practice" title="Settings" actions={<SignOutButton />} />

      <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        <h2 className="text-h3">Practice</h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <PracticeMark practiceName={practiceName} logoUrl={logoUrl} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{practiceName}</p>
              <p className="text-small text-muted-foreground">
                Admin accounts need a logo. It shows on invoices, notes and agreements.
              </p>
            </div>
          </div>
          <PracticeDetailsDialog practiceName={practiceName} logoUrl={logoUrl} triggerClassName="border-border-action" />
        </div>
        <dl className="grid grid-cols-1 gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-small text-muted-foreground">Your name</dt>
            <dd className="font-semibold">{name}</dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Country</dt>
            <dd className="font-semibold">{place.name}</dd>
            <dd className="text-small text-muted-foreground">{place.currency}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
