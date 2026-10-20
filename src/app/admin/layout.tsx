import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/components/nav-items";
import { pendingClinicianCount, practiceLogoUrlFor } from "@/lib/practice";

/** Admin app (spec v2 section 5). Clinicians are sent back to their app by requireAdmin(). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { name, practiceName, practiceId } = await requireAdmin();
  const [logoUrl, pending] = await Promise.all([practiceLogoUrlFor(practiceId), pendingClinicianCount(practiceId)]);

  return (
    <AppShell
      app="admin"
      practiceBrand={{ name: practiceName, logoUrl, caption: "Admin account" }}
      user={{ title: name, subtitle: "Administrator", markName: name, logoUrl: null }}
      badges={{ [ADMIN_SECTIONS.clinicians.href]: pending }}
    >
      {children}
    </AppShell>
  );
}
