import { Download, MessageSquareText, Pencil, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractDocument } from "@/components/contract-document";
import { ContractThread } from "@/components/contract-thread";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { loadContract, practiceLetterhead } from "@/lib/contract-data";
import { contractSections, STATUS_BADGE } from "@/lib/contracts";
import { sendContractReply } from "../actions";
import { MarkContractSeen } from "./mark-seen";

/**
 * Contract, admin side (spec v2 section 5c and the prototype): the contract, its status and the
 * message thread, with Continue editing (draft), Update and resend (sent or message) or Download
 * PDF (signed).
 */
export default async function AdminContractPage({ params }: PageProps<"/admin/contracts/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const found = await loadContract(id, { practiceId: admin.practiceId });
  if (!found) notFound();
  const k = found.contract;
  const lh = await practiceLetterhead(admin.practiceId);
  const first = found.clinicianName.split(" ")[0];
  const badge = STATUS_BADGE[k.status];

  const action =
    k.status === "draft" ? (
      <Button nativeButton={false} render={<Link href={`/admin/contracts/${k.id}/edit`} />}>
        <Pencil aria-hidden /> Continue editing
      </Button>
    ) : k.status === "signed" ? (
      <Button variant="outline" nativeButton={false} render={<a href={`/api/contracts/${k.id}/pdf`} target="_blank" rel="noopener" />}>
        <Download aria-hidden /> Download PDF
      </Button>
    ) : (
      <Button variant="outline" nativeButton={false} render={<Link href={`/admin/contracts/${k.id}/edit`} />}>
        <Send aria-hidden /> Update and resend
      </Button>
    );

  return (
    <div className="grid grid-cols-1 gap-6">
      <MarkContractSeen contractId={k.id} />
      <PageHeader
        back={{ href: "/admin/contracts", label: "Contracts" }}
        overline={`${k.label} · ${found.clinicianName}`}
        title={k.type}
        actions={action}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {k.status === "draft" && <span className="text-small text-muted-foreground">Only you can see this draft.</span>}
      </div>

      {k.status === "feedback" && (
        <div role="status" className="flex gap-3 rounded-md bg-info px-4 py-3.5 text-info-foreground">
          <MessageSquareText className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">{first} sent a message.</span> Reply below, or update the contract and send it
            again.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <ContractDocument
          practiceName={lh.practiceName}
          logoUrl={lh.logoUrl}
          letterhead={k.letterhead ?? lh.letterhead}
          label={k.label}
          type={k.type}
          clinicianName={found.clinicianName}
          sections={contractSections(k.type, k.terms, found.clinicianName, lh.practiceName)}
          admin={{ label: "Practice admin", name: k.adminSignedName ?? admin.name, image: k.adminSignature, at: k.adminSignedAt?.toISOString() ?? null }}
          clinician={{ label: "Clinician", name: found.clinicianName, image: k.clinicianSignature, at: k.clinicianSignedAt?.toISOString() ?? null }}
        />
        {k.status !== "draft" && (
          <ContractThread
            contractId={k.id}
            me="admin"
            messages={found.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
            send={sendContractReply}
            intro={`Questions and replies about this contract. ${first} is told about each new message.`}
            placeholder={`Reply to ${first}`}
            buttonLabel="Send reply"
          />
        )}
      </div>
    </div>
  );
}
