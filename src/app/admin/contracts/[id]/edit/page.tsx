import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { practiceLetterhead, loadContract } from "@/lib/contract-data";
import { activeClinicians } from "@/lib/contract-form-data";
import type { ContractType } from "@/lib/contracts";
import { ContractForm } from "../../contract-form";

/** Continue editing (draft) or Update and resend (sent, or after a message). */
export default async function EditContractPage({ params }: PageProps<"/admin/contracts/[id]/edit">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const found = await loadContract(id, { practiceId: admin.practiceId });
  if (!found) notFound();
  const k = found.contract;
  if (k.status === "signed") redirect(`/admin/contracts/${id}`);
  const [team, lh] = await Promise.all([activeClinicians(admin.practiceId), practiceLetterhead(admin.practiceId)]);
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: `/admin/contracts/${id}`, label: k.label }}
        overline={k.status === "draft" ? "Draft" : "Update and resend"}
        title={k.status === "draft" ? "Continue editing" : "Update the contract"}
      />
      <ContractForm
        id={k.id}
        label={k.label}
        status={k.status}
        practiceName={lh.practiceName}
        adminName={admin.name}
        logoUrl={lh.logoUrl}
        clinicians={team.some((c) => c.id === k.clinicianId) ? team : [...team, { id: k.clinicianId, name: found.clinicianName }]}
        letterhead={lh.letterhead}
        initial={{ clinicianId: k.clinicianId, type: k.type as ContractType, terms: k.terms }}
      />
    </div>
  );
}
