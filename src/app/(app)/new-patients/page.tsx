import { UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clinicianSettings } from "@/lib/account";
import { requireClinician } from "@/lib/auth";
import { ageFrom } from "@/lib/format";
import { openOffersFor } from "@/lib/patient-offers";
import { OFFER_FOR, SERVICES, type Service } from "@/lib/patient-options";
import { cn } from "@/lib/utils";
import { OfferAnswer } from "./offer-answer";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (d: string) => DATE.format(new Date(`${d}T00:00:00Z`));

/**
 * New patients (decided 31 Oct 2026): patients the admin offered for this clinician's discipline.
 * Clinicians accept or decline each one (the email links to its card), and the admin assigns one
 * of the clinicians who accepted.
 */
export default async function NewPatientsPage({ searchParams }: PageProps<"/new-patients">) {
  const clinician = await requireClinician();
  const { offer: picked } = await searchParams;
  const { discipline } = await clinicianSettings(clinician.id);
  const all = await openOffersFor(clinician.practiceId, clinician.id, discipline);
  // From the email's "Accept or decline" link (?offer=<id>): that patient first, highlighted.
  const offers = [...all.filter((o) => o.id === picked), ...all.filter((o) => o.id !== picked)];
  const missing = typeof picked === "string" && !all.some((o) => o.id === picked);

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        overline="Offered by your practice"
        title="New patients"
        description="Patients your practice is offering to clinicians of your discipline. Accept the ones you can take and decline the others; your admin assigns each patient, usually to the first to accept."
      />

      {missing && (
        <p role="status" className="rounded-md bg-info px-4 py-3.5 text-info-foreground">
          The patient in your email isn&apos;t waiting for an answer any more: your admin has assigned them or withdrawn the offer.
        </p>
      )}

      {!discipline ? (
        <EmptyState
          icon={UserRoundSearch}
          title="Set your role first"
          action={
            <Button nativeButton={false} render={<Link href="/settings" />}>
              Go to Settings
            </Button>
          }
        >
          Your practice offers new patients by type of care. Set your role in Settings so we can show you the ones for you.
        </EmptyState>
      ) : offers.length === 0 ? (
        <EmptyState icon={UserRoundSearch} title="No new patients waiting">
          When your practice offers a patient for your discipline, we&apos;ll email you and they&apos;ll show here.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4">
          {offers.map((o) => {
            const services = SERVICES.filter((s) => o.servicesOrdered.includes(s.value));
            return (
              <li
                key={o.id}
                id={`offer-${o.id}`}
                className={cn(
                  "grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6",
                  o.id === picked && "ring-3 ring-ring",
                )}
              >
                <div className="min-w-0">
                  <h2 className="text-h3">{o.fullName}</h2>
                  <p className="text-small text-muted-foreground">
                    Age {ageFrom(o.dateOfBirth)} · Needs {OFFER_FOR[o.service as Service].care} · Offered{" "}
                    <RelativeDay iso={o.offeredAt.toISOString()} withTime />
                  </p>
                </div>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Detail label="Home address">{o.address ?? "Not added yet"}</Detail>
                  <Detail label="Insurer">{o.insurer ?? "Not added yet"}</Detail>
                  <Detail label="Start of care">
                    {o.startOfCare ? fmt(o.startOfCare) : o.referralDate ? `Referred ${fmt(o.referralDate)}` : "Not set yet"}
                  </Detail>
                  <Detail label="Ordering doctor">{o.orderingDoctor ?? "Not added yet"}</Detail>
                  <Detail label="Diagnosis">
                    {o.diagnoses.length ? o.diagnoses.map((d) => `${d.code} ${d.description}`).join(", ") : "Not added yet"}
                  </Detail>
                </dl>
                {services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s) => (
                      <Badge key={s.value} variant={s.value === o.service ? "accent" : "neutral"}>
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="border-t border-border-subtle pt-4">
                  <OfferAnswer offerId={o.id} name={o.fullName} answer={o.answer} reason={o.reason} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}
