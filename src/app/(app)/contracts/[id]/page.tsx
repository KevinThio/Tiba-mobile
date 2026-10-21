import { Download, FileSignature } from "lucide-react";
import { notFound } from "next/navigation";
import { ContractDocument } from "@/components/contract-document";
import { ContractThread } from "@/components/contract-thread";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireClinician } from "@/lib/auth";
import { loadContract, practiceLetterhead } from "@/lib/contract-data";
import { contractSections } from "@/lib/contracts";
import { messageAdmin } from "../actions";
import { MarkSeen, SignContract } from "./sign-contract";

/**
 * Contract, clinician side (spec v2 section 4 and the prototype): the contract on the letterhead,
 * Sign and send back (or Download PDF once signed), and a message thread with the admin.
 */
export default async function ContractPage({ params }: PageProps<"/contracts/[id]">) {
  const clinician = await requireClinician();
  const { id } = await params;
  const found = await loadContract(id, { clinicianId: clinician.id });
  if (!found) notFound();
  const k = found.contract;
  const lh = await practiceLetterhead(clinician.practiceId);
  const adminName = k.adminSignedName ?? "your admin";
  const adminFirst = adminName.split(" ")[0];

  return (
    <div className="grid grid-cols-1 gap-6">
      <MarkSeen contractId={k.id} />
      <PageHeader
        back={{ href: "/contracts", label: "Contracts" }}
        overline={`${k.label} · from ${adminName}`}
        title={k.type}
        actions={
          k.status === "signed" ? (
            <Button variant="outline" nativeButton={false} render={<a href={`/api/contracts/${k.id}/pdf`} target="_blank" rel="noopener" />}>
              <Download aria-hidden /> Download PDF
            </Button>
          ) : undefined
        }
      />

      {k.status === "sent" && (
        <div role="status" className="flex gap-3 rounded-md bg-accent px-4 py-3.5 text-accent-foreground">
          <FileSignature className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Ready for your signature.</span> Read it through, then sign below. If something
            needs changing, send {adminFirst} a message instead.
          </p>
        </div>
      )}
      {k.status === "feedback" && (
        <div role="status" className="rounded-md bg-info px-4 py-3.5 text-info-foreground">
          <span className="font-semibold">Waiting for {adminFirst}.</span> They&apos;ll reply below or send you an updated
          contract to sign.
        </div>
      )}
      {k.status === "signed" && (
        <div role="status" className="rounded-md bg-success px-4 py-3.5 text-success-foreground">
          <span className="font-semibold">Signed and locked.</span> A copy is in your profile.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="grid gap-6">
          <ContractDocument
            practiceName={lh.practiceName}
            logoUrl={lh.logoUrl}
            letterhead={k.letterhead ?? lh.letterhead}
            label={k.label}
            type={k.type}
            clinicianName={found.clinicianName}
            sections={contractSections(k.type, k.terms, found.clinicianName, lh.practiceName)}
            admin={{ label: "Practice admin", name: adminName, image: k.adminSignature, at: k.adminSignedAt?.toISOString() ?? null }}
            clinician={{ label: "Clinician", name: found.clinicianName, image: k.clinicianSignature, at: k.clinicianSignedAt?.toISOString() ?? null }}
          />
          {k.status === "sent" && <SignContract contractId={k.id} name={clinician.name} adminFirst={adminFirst} />}
        </div>
        <ContractThread
          contractId={k.id}
          me="clinician"
          messages={found.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          send={k.status === "signed" ? null : messageAdmin}
          intro={k.status === "signed" ? "Messages about this contract." : "Questions about this contract? Message your admin here."}
          placeholder={`Message ${adminFirst}`}
          buttonLabel="Message admin"
        />
      </div>
    </div>
  );
}
