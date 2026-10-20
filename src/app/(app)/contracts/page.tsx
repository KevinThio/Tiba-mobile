import { FileSignature } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireClinician } from "@/lib/auth";

export default async function ContractsPage() {
  const { practiceName } = await requireClinician();
  return (
    <div className="grid gap-8">
      <PageHeader overline={practiceName} title="Contracts" back={{ href: "/settings", label: "Account" }} />
      <EmptyState icon={FileSignature} title="No contracts yet">
        When your practice sends you a contract, it shows here for you to read and sign.
      </EmptyState>
    </div>
  );
}
