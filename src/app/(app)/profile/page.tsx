import { and, desc, eq } from "drizzle-orm";
import { Download, FileSignature } from "lucide-react";
import { FileList, FileSlot } from "@/components/file-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { clinicianSettings } from "@/lib/account";
import { requireClinician } from "@/lib/auth";
import { disciplineLabel } from "@/lib/disciplines";
import { listFiles, toSummary } from "@/lib/files";
import { loadProfile } from "@/lib/profile-data";
import { PROFILE_DOCS } from "@/lib/profiles";
import { ProfileForm } from "./profile-form";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Profile (spec v2 section 5c and the prototype): About you, contact details, career experience,
 * education, certifications, emergency contact and Documents (ID, resume, signed job description,
 * W-9, other documents, and signed contracts listed automatically). The admin can see it all.
 */
export default async function ProfilePage() {
  const clinician = await requireClinician();
  const [settings, profile, docs, signed] = await Promise.all([
    clinicianSettings(clinician.id),
    loadProfile(clinician.id),
    listFiles(clinician.practiceId, "clinician", clinician.id),
    db
      .select({ id: contracts.id, label: contracts.label, type: contracts.type, signedAt: contracts.clinicianSignedAt })
      .from(contracts)
      .where(and(eq(contracts.clinicianId, clinician.id), eq(contracts.status, "signed")))
      .orderBy(desc(contracts.clinicianSignedAt)),
  ]);
  const others = docs.filter((d) => !d.slot);
  const owner = { ownerKind: "clinician" as const, ownerId: clinician.id };

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/settings", label: "Account" }}
        overline={settings.discipline ? disciplineLabel(settings.discipline) : "Your profile"}
        title="Your profile"
        description="Your admin can see your profile and download your documents."
      />
      <ProfileForm
        discipline={settings.discipline}
        profile={{
          speciality: profile.speciality,
          licenseNumber: profile.licenseNumber,
          licenseIssuer: profile.licenseIssuer,
          licenseExpiry: profile.licenseExpiry,
          education: profile.education,
          certifications: profile.certifications,
          experience: profile.experience,
          phone: profile.phone,
          // Starts as the sign-in email until they choose another.
          contactEmail: profile.contactEmail || clinician.email,
          address: profile.address,
          city: profile.city,
          region: profile.region,
          postalCode: profile.postalCode,
          emergencyName: profile.emergencyName,
          emergencyRelationship: profile.emergencyRelationship,
          emergencyPhone: profile.emergencyPhone,
        }}
      />

      <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-h3">Documents</h2>
          <p className="text-small text-muted-foreground">Your admin can see and download these. PDF, Word or an image, up to 5 MB.</p>
        </div>
        {PROFILE_DOCS.map((d) => {
          const file = docs.find((x) => x.slot === d.slot);
          return <FileSlot key={d.slot} owner={owner} slot={d.slot} label={d.label} hint={d.hint} file={file ? toSummary(file) : null} editable />;
        })}
        <div className="grid gap-2">
          <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Other documents</p>
          <FileList
            owner={owner}
            files={others.map(toSummary)}
            canUpload
            canRemove
            requireDescription
            hint="Anything else your practice asks for, each with a short description. Remove one and upload it again to replace it."
            emptyText="No other documents yet."
          />
        </div>
        <div className="grid gap-2">
          <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Signed contracts</p>
          {signed.length ? (
            <ul className="grid gap-2">
              {signed.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border-subtle px-4 py-3">
                  <FileSignature className="size-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{k.type}</p>
                    <p className="text-small text-muted-foreground">
                      {k.label}
                      {k.signedAt && ` · signed ${DATE.format(k.signedAt)}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" nativeButton={false} render={<a href={`/api/contracts/${k.id}/pdf`} target="_blank" rel="noopener" />}>
                    <Download aria-hidden /> PDF
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-subtle-foreground">Contracts you sign show here automatically.</p>
          )}
        </div>
      </section>
    </div>
  );
}
