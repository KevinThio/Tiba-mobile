import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { activeClinicians } from "@/lib/contract-form-data";
import { practiceLetterhead } from "@/lib/contract-data";
import { ContractForm } from "../contract-form";

/** New contract (spec v2 section 5c). "Send contract" on a clinician's page picks them here. */
export default async function NewContractPage({ searchParams }: PageProps<"/admin/contracts/new">) {
  const admin = await requireAdmin();
  const { clinician } = await searchParams;
  const [team, lh] = await Promise.all([activeClinicians(admin.practiceId), practiceLetterhead(admin.practiceId)]);
  const preset = typeof clinician === "string" && team.some((c) => c.id === clinician) ? clinician : "";
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader back={{ href: "/admin/contracts", label: "Contracts" }} overline="New contract" title="Create a contract" />
      <ContractForm
        label="New contract"
        practiceName={lh.practiceName}
        adminName={admin.name}
        logoUrl={lh.logoUrl}
        clinicians={team}
        letterhead={lh.letterhead}
        initial={{
          clinicianId: preset,
          type: "Independent contractor agreement",
          terms: { start: "", length: "12 months", pay: "", role: "", extra: "" },
        }}
      />
    </div>
  );
}
