import { FilePlus2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { practiceContracts } from "@/lib/contract-data";
import { ContractsList } from "./contracts-list";

/** Admin Contracts (spec v2 section 5c): every contract with its status, in tabs, and New contract. */
export default async function AdminContractsPage() {
  const admin = await requireAdmin();
  const rows = await practiceContracts(admin.practiceId);
  const waiting = rows.filter((r) => r.status === "sent").length;
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        overline={waiting ? `${waiting} waiting to sign` : "Your team"}
        title="Contracts"
        actions={
          <Button nativeButton={false} render={<Link href="/admin/contracts/new" />}>
            <FilePlus2 aria-hidden /> New contract
          </Button>
        }
      />
      <ContractsList
        contracts={rows.map((r) => ({
          id: r.id,
          label: r.label,
          type: r.type,
          status: r.status,
          clinicianName: r.clinicianName,
          sentAt: r.sentAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          isNew: r.status === "feedback" && !r.seenByAdminAt,
        }))}
      />
    </div>
  );
}
