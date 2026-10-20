import { CircleUserRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireClinician } from "@/lib/auth";

export default async function ProfilePage() {
  await requireClinician();
  return (
    <div className="grid gap-8">
      <PageHeader title="Your profile" back={{ href: "/settings", label: "Account" }} />
      <EmptyState icon={CircleUserRound} title="Your profile is coming soon">
        Your discipline, licence, education, certifications and documents will live here. Your admin can see them.
      </EmptyState>
    </div>
  );
}
