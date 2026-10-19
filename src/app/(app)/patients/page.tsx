import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireClinician } from "@/lib/auth";

export default async function PatientsPage() {
  await requireClinician();
  return (
    <div className="grid gap-8">
      <PageHeader title="Patients" description="Find a patient and see all their visits and notes." />
      <EmptyState icon={UsersRound} title="Patient records are coming soon">
        This is where you&apos;ll search for patients, open their notes and create invoices.
      </EmptyState>
    </div>
  );
}
