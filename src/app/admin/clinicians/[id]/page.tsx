import { and, desc, eq } from "drizzle-orm";
import { Download, FileSignature, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileList, FileSlot } from "@/components/file-list";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { clinicians, contracts, locations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { disciplineLabel, isDiscipline } from "@/lib/disciplines";
import { listFiles, toSummary } from "@/lib/files";
import { loadProfile } from "@/lib/profile-data";
import { CERT_STATUS, certificationStatus, PROFILE_DOCS } from "@/lib/profiles";
import { ClinicianStatusActions } from "../clinician-status-actions";
import { EmergencyContactForm } from "./emergency-contact-form";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => DATE.format(new Date(`${iso}T00:00:00Z`));

/**
 * Clinician profile, admin side (spec v2 section 5 and the prototype): details, the clinician's
 * qualifications, education, certifications and profile documents (all downloadable), account
 * status, the emergency contact, admin-only documents, and Send contract.
 */
export default async function AdminClinicianPage({ params }: PageProps<"/admin/clinicians/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const [c] = await db
    .select({
      id: clinicians.id,
      name: clinicians.name,
      email: clinicians.email,
      status: clinicians.status,
      discipline: clinicians.discipline,
      createdAt: clinicians.createdAt,
      locationId: clinicians.locationId,
      locationName: locations.name,
    })
    .from(clinicians)
    .leftJoin(locations, eq(locations.id, clinicians.locationId))
    .where(and(eq(clinicians.id, id), eq(clinicians.practiceId, admin.practiceId), eq(clinicians.role, "clinician")));
  if (!c) notFound();

  const [profile, own, adminDocs, signed] = await Promise.all([
    loadProfile(c.id),
    listFiles(admin.practiceId, "clinician", c.id),
    listFiles(admin.practiceId, "clinician_admin", c.id),
    db
      .select({ id: contracts.id, label: contracts.label, type: contracts.type, signedAt: contracts.clinicianSignedAt })
      .from(contracts)
      .where(and(eq(contracts.clinicianId, c.id), eq(contracts.status, "signed")))
      .orderBy(desc(contracts.clinicianSignedAt)),
  ]);
  const role = isDiscipline(c.discipline) ? disciplineLabel(c.discipline) : "Discipline not set";
  const others = own.filter((d) => !d.slot);
  const address = [profile.address, profile.city, [profile.region, profile.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const monthText = (m: string) => (m ? new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : "");
  const owner = { ownerKind: "clinician" as const, ownerId: c.id };

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/admin/clinicians", label: "Clinicians" }}
        overline={role}
        title={c.name}
        actions={
          <div className="flex flex-wrap gap-2">
            {c.status === "active" && (
              <Button nativeButton={false} render={<Link href={`/admin/contracts/new?clinician=${c.id}`} />}>
                <Send aria-hidden /> Send contract
              </Button>
            )}
            <ClinicianStatusActions clinicianId={c.id} name={c.name} status={c.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <Card title="Details">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Role">{role}</Detail>
            <Detail label="Sign-in email">{c.email}</Detail>
            <Detail label="Contact email">{profile.contactEmail || <Missing />}</Detail>
            <Detail label="Phone">{profile.phone || <Missing />}</Detail>
            <Detail label="Address">{address || <Missing />}</Detail>
            <Detail label="Location">
              {c.locationId ? (
                <Link href={`/admin/locations/${c.locationId}`} className="underline-offset-2 hover:underline">
                  {c.locationName}
                </Link>
              ) : (
                <span className="text-muted-foreground">Not based at a location yet. Add them from a location&apos;s page.</span>
              )}
            </Detail>
            <Detail label="Joined">{DATE.format(c.createdAt)}</Detail>
            <Detail label="Account">
              {c.status === "active" ? "Active · They can sign in and write notes." : c.status === "pending" ? "Waiting for you to verify" : "Deactivated · Their notes are kept."}
            </Detail>
          </dl>
        </Card>

        <Card title="Qualifications">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Speciality">{profile.speciality || <Missing />}</Detail>
            <Detail label="Licence">{profile.licenseNumber || <Missing />}</Detail>
            <Detail label="Issued by">{profile.licenseIssuer || <Missing />}</Detail>
            <Detail label="Licence expires">{profile.licenseExpiry ? day(profile.licenseExpiry) : <Missing />}</Detail>
          </dl>
        </Card>

        <Card title="Education">
          {profile.education.length ? (
            <ul className="grid gap-2">
              {profile.education.map((e) => (
                <li key={e.id} className="rounded-sm bg-muted px-3 py-2.5">
                  <p className="font-semibold">{e.course}</p>
                  <p className="text-small text-muted-foreground">{[e.level, e.school, e.year].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Missing text="Nothing added yet." />
          )}
        </Card>

        <Card title="Career experience">
          {profile.experience.length ? (
            <ul className="grid gap-2">
              {profile.experience.map((j) => (
                <li key={j.id} className="rounded-sm bg-muted px-3 py-2.5">
                  <p className="font-semibold">{j.role}</p>
                  <p className="text-small text-muted-foreground">
                    {j.employer}
                    {j.start && ` · ${monthText(j.start)} – ${j.end ? monthText(j.end) : "present"}`}
                  </p>
                  {j.summary && <p className="mt-1 text-small">{j.summary}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Missing text="Nothing added yet." />
          )}
        </Card>

        <Card title="Certifications">
          {profile.certifications.length ? (
            <ul className="grid gap-2">
              {profile.certifications.map((cert) => {
                const status = certificationStatus(cert.expiry);
                return (
                  <li key={cert.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-muted px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold">{cert.name}</p>
                      <p className="text-small text-muted-foreground">
                        {[cert.issuer, cert.expiry && `expires ${day(cert.expiry)}`].filter(Boolean).join(" · ") || "No issuer or expiry"}
                      </p>
                    </div>
                    {status && <Badge variant={CERT_STATUS[status].variant}>{CERT_STATUS[status].label}</Badge>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Missing text="Nothing added yet." />
          )}
        </Card>

        <Card title="Profile documents" className="md:col-span-2">
          <p className="text-small text-muted-foreground">Uploaded by {c.name.split(" ")[0]}.</p>
          {PROFILE_DOCS.map((d) => {
            const file = own.find((x) => x.slot === d.slot);
            return <FileSlot key={d.slot} owner={owner} slot={d.slot} label={d.label} file={file ? toSummary(file) : null} editable={false} />;
          })}
          {others.length > 0 && (
            <FileList owner={owner} files={others.map(toSummary)} canUpload={false} canRemove={false} hint="Other documents" emptyText="" />
          )}
          {signed.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border-subtle px-4 py-3">
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
            </div>
          ))}
        </Card>

        <Card title="Emergency contact">
          <EmergencyContactForm
            clinicianId={c.id}
            initial={{ name: profile.emergencyName, relationship: profile.emergencyRelationship, phone: profile.emergencyPhone }}
          />
        </Card>

        <Card title="Documents">
          <FileList
            owner={{ ownerKind: "clinician_admin", ownerId: c.id }}
            files={adminDocs.map(toSummary)}
            canUpload
            canRemove
            hint="Registration, insurance, DBS, contracts. Only admins can see these. PDF, Word or an image, up to 5 MB."
            emptyText="No documents yet."
          />
        </Card>
      </div>
    </div>
  );
}

function Card({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6 ${className ?? ""}`}>
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
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

function Missing({ text = "Not added" }: { text?: string }) {
  return <span className="text-subtle-foreground">{text}</span>;
}
