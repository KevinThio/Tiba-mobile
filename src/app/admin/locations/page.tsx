import { asc, eq } from "drizzle-orm";
import { MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/** Every location in the practice, with its address and type of facility (spec v2 admin Locations). */
export default async function AdminLocationsPage() {
  const admin = await requireAdmin();
  const rows = await db
    .select({
      id: locations.id,
      name: locations.name,
      facility: locations.facility,
      address: locations.address,
      services: locations.services,
    })
    .from(locations)
    .where(eq(locations.practiceId, admin.practiceId))
    .orderBy(asc(locations.name));

  const addButton = (
    <Button nativeButton={false} render={<Link href="/admin/locations/new" />}>
      <Plus aria-hidden />
      Add location
    </Button>
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        overline={`${rows.length} ${rows.length === 1 ? "location" : "locations"}`}
        title="Locations"
        actions={rows.length > 0 ? addButton : undefined}
      />

      {rows.length === 0 ? (
        <EmptyState icon={MapPin} title="No locations yet" action={addButton}>
          Add each place you see patients, including online sessions and home visits.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
          {rows.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-4 last:border-b-0 sm:px-5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <MapPin className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/locations/${l.id}`}
                  className="block truncate rounded-xs font-semibold outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring"
                >
                  {l.name}
                </Link>
                <p className="truncate text-small text-muted-foreground">{l.address ?? "No address · online"}</p>
                <p className="truncate text-caption text-subtle-foreground">{l.services.join(" · ")}</p>
              </div>
              <Badge variant="neutral">{l.facility}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
