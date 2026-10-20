import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ADMIN_SECTIONS } from "@/components/nav-items";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";

// Placeholder for each admin screen until it's built. Built screens get their own folder,
// which takes priority over this dynamic route.
type Section = Exclude<keyof typeof ADMIN_SECTIONS, "overview" | "settings">;

export default async function AdminSectionPage({ params }: PageProps<"/admin/[section]">) {
  await requireAdmin();
  const { section } = await params;
  if (!(section in ADMIN_SECTIONS) || section === "overview" || section === "settings") notFound();
  const { label, overline, description, icon } = ADMIN_SECTIONS[section as Section];

  return (
    <div className="grid gap-8">
      <PageHeader overline={overline} title={label} />
      <EmptyState icon={icon} title={`${label} is coming soon`}>
        {description}
      </EmptyState>
    </div>
  );
}
