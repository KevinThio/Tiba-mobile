import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { AddLocationForm } from "./add-location-form";

/** Admin Add location (spec v2): name, type of facility, address and services. */
export default async function AdminAddLocationPage() {
  await requireAdmin();
  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline="New location" title="Add a location" back={{ href: "/admin/locations", label: "Locations" }} />
      <AddLocationForm />
    </div>
  );
}
