import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FileList } from "@/components/file-list";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { listFiles, toSummary } from "@/lib/files";
import { RemoveLocationButton } from "./remove-location-button";

/**
 * Location profile (spec v2 section 5 and the prototype): address, type of facility and services,
 * and PDF files with a short description. Remove location asks to confirm; the last one can't go.
 */
export default async function LocationPage({ params }: PageProps<"/admin/locations/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [all, files] = await Promise.all([
    db.select().from(locations).where(eq(locations.practiceId, admin.practiceId)),
    listFiles(admin.practiceId, "location", id),
  ]);
  const location = all.find((l) => l.id === id);
  if (!location) notFound();

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/admin/locations", label: "Locations" }}
        overline={location.facility}
        title={location.name}
        actions={<RemoveLocationButton locationId={location.id} name={location.name} last={all.length === 1} />}
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
