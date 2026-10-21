import { Bell, ChevronRight, FileSignature, Lock, ReceiptText, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PracticeDetailsDialog } from "@/components/practice-details-dialog";
import { PracticeMark } from "@/components/practice-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { requireClinician } from "@/lib/auth";
import { clinicianSettings } from "@/lib/account";
import { moneyInputValue } from "@/lib/countries";
import { unreadNotificationCount } from "@/lib/notifications";
import { canEditPractice, practiceBilling, practiceLogoUrlFor } from "@/lib/practice";
import { LocalCountry } from "./local-country";
import { DisciplineForm, VisitFeeForm } from "./settings-forms";

/** Desktop: Settings. Phone: the Account tab, which also links to the screens that aren't tabs. */
export default async function SettingsPage() {
  const clinician = await requireClinician();
  const { name, practiceName, practiceId } = clinician;
  const [logoUrl, canEdit, settings, billing, unread] = await Promise.all([
    practiceLogoUrlFor(practiceId),
    canEditPractice(clinician),
    clinicianSettings(clinician.id),
    practiceBilling(practiceId),
    unreadNotificationCount(clinician.id),
  ]);
  // A fee saved in another currency (before the practice changed it) isn't shown as this one's.
  const fee = settings.visitFee?.currency === billing.currency ? moneyInputValue(settings.visitFee.minor, billing.currency) : "";

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader
        overline="Your practice"
        title={
          <>
            <span className="md:hidden">Account</span>
            <span className="hidden md:block">Settings</span>
          </>
        }
        actions={<SignOutButton />}
      />

      {/* On phones this screen is the Account tab, so it links to everything without a tab. */}
      <nav aria-label="Account" className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm md:hidden">
        <AccountRow href="/profile" title={name} meta="Your profile · education, certifications, documents" lead={<PracticeMark practiceName={name} logoUrl={null} className="size-10 rounded-full" />} />
        <AccountRow href="/contracts" title="Contracts" meta="Contracts from your practice" icon={FileSignature} />
        <AccountRow
          href="/notifications"
          title="Notifications"
          meta={unread ? `${unread} new` : "Contracts, replies and invoice questions"}
          icon={Bell}
        />
        <AccountRow href="/invoices" title="Invoices" meta="Bill your signed visits" icon={ReceiptText} />
      </nav>

      <Section title="Your role">
        <DisciplineForm discipline={settings.discipline} />
      </Section>

      <Section title="Notes and signing">
        <p className="text-muted-foreground">
          Your patient can sign each note on your device. Their signature box is always there and is optional, so you can
          sign a note on your own when they can&apos;t.
        </p>
      </Section>

      <Section title="Invoicing">
        <div>
          <p className="text-small text-muted-foreground">Country and currency</p>
          <p className="font-semibold">
            <LocalCountry country={billing.country} currency={billing.currency} />
          </p>
          <p className="text-small text-muted-foreground">Your practice admin sets the country and billing currency.</p>
        </div>
        <VisitFeeForm fee={fee} currency={billing.currency} />
      </Section>

      <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        <h2 className="text-h3">Practice</h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <PracticeMark practiceName={practiceName} logoUrl={logoUrl} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{practiceName}</p>
              <p className="text-small text-muted-foreground">
                {canEdit ? "Shown on your notes and invoices." : "Shown on your notes and invoices. Your practice admin manages the name and logo."}
              </p>
            </div>
          </div>
          {canEdit && (
            <PracticeDetailsDialog practiceName={practiceName} logoUrl={logoUrl} triggerClassName="border-border-action" />
          )}
        </div>
      </section>

      <p className="flex items-center gap-2 text-small text-muted-foreground">
        <Lock className="size-4 shrink-0" aria-hidden />
        Your patients&apos; notes are private and stored safely. Only you and your practice admin can see them.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

function AccountRow({
  href,
  title,
  meta,
  icon: Icon,
  lead,
}: {
  href: string;
  title: string;
  meta: string;
  icon?: LucideIcon;
  lead?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 outline-none last:border-b-0 first:rounded-t-lg last:rounded-b-lg focus-visible:ring-3 focus-visible:ring-ring"
    >
      {lead ?? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          {Icon && <Icon className="size-5" aria-hidden />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="block truncate text-small text-muted-foreground">{meta}</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  );
}
