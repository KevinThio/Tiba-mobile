import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { practiceLogoUrlFor } from "@/lib/practice";

/** Admin app (spec v2 section 5). Clinicians are sent back to their app by requireAdmin(). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { id, name, practiceName, updatedAt } = await requireAdmin();
  const logoUrl = await practiceLogoUrlFor(id, updatedAt);

  return (
    <AppShell
      app="admin"
      practiceBrand={{ name: practiceName, logoUrl, caption: "Admin account" }}
      user={{ title: name, subtitle: "Administrator", markName: name, logoUrl: null }}
    >
      {children}
    </AppShell>
  );
}
