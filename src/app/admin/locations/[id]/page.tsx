import { and, asc, eq, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FileList } from "@/components/file-list";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { clinicians, locations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { disciplineLabel, isDiscipline } from "@/lib/disciplines";
import { listFiles, toSummary } from "@/lib/files";
import { LocationClinicians } from "./location-clinicians";
import { RemoveLocationButton } from "./remove-location-button";

/**
 * Location profile (spec v2 section 5 and the prototype): address, type of facility and services,
 * the clinicians based there (add or remove them), and PDF files with a short description.
 * Remove location asks to confirm and where its clinicians move; the last one can't go.
 */
export default async function LocationPage({ params }: PageProps<"/admin/locations/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [all, files, team] = await Promise.all([
    db.select().from(locations).where(eq(locations.practiceId, admin.practiceId)),
    listFiles(admin.practiceId, "location", id),
    // Deactivated clinicians can't be added, but still show if they're based here.
    db
      .select({ id: clinicians.id, name: clinicians.name, discipline: clinicians.discipline, status: clinicians.status, locationId: clinicians.locationId })
      .from(clinicians)
      .where(and(eq(clinicians.practiceId, admin.practiceId), eq(clinicians.role, "clinician"), ne(clinicians.status, "pending")))
      .orderBy(asc(clinicians.name)),
  ]);
  const location = all.find((l) => l.id === id);
  if (!location) notFound();

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/admin/locations", label: "Locations" }}
        overline={location.facility}
        title={location.name}
        actions={
          <RemoveLocationButton
            locationId={location.id}
            name={location.name}
            clinicianCount={team.filter((c) => c.locationId === location.id).length}
            otherLocations={all.filter((l) => l.id !== location.id).map((l) => ({ id: l.id, name: l.name }))}
          />
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Details</h2>
          <dl className="grid gap-4">
            <div>
              <dt className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Address</dt>
              <dd className="mt-1 break-words">{location.address ?? "No address · online"}</dd>
            </div>
            <div>
              <dt className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Type of facility</dt>
              <dd className="mt-1">{location.facility}</dd>
            </div>
            <div>
              <dt className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Type of services</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {location.services.map((s) => (
                  <Badge key={s} variant="neutral">
                    {s}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </section>
        <section className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Clinicians</h2>
          <LocationClinicians
            locationId={location.id}
            locationName={location.name}
            clinicians={team
              .filter((c) => c.status === "active" || c.locationId === location.id)
              .map((c) => ({
                id: c.id,
                name: c.name,
                role: `${isDiscipline(c.discipline) ? disciplineLabel(c.discipline) : "Discipline not set"}${c.status === "deactivated" ? " · deactivated" : ""}`,
                locationId: c.locationId,
                locationName: all.find((l) => l.id === c.locationId)?.name ?? null,
              }))}
          />
        </section>
        <section className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Files</h2>
          <FileList
            owner={{ ownerKind: "location", ownerId: location.id }}
            files={files.map(toSummary)}
            canUpload
            canRemove
            pdfOnly
            requireDescription
            hint="PDFs only, each with a short description. Download or remove them any time."
            emptyText="No files yet. Add certificates, leases or policies."
          />
        </section>
      </div>
    </div>
  );
}
