import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { AgreementDocument } from "@/components/agreement-document";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { agreementStatus, isComplete, loadAgreement, practiceAgreementClauses } from "@/lib/agreements";
import { requireAdmin } from "@/lib/auth";
import { practiceLetterhead } from "@/lib/contract-data";
import { AgreementForm } from "./agreement-form";
import { FinishSigning } from "./agreement-signing";

/**
 * Service agreement (spec v2 section 5, modelled on a home care agency's form): the details,
 * the practice's wording and the client's answers; the client (or a responsible party) and the
 * agency witness sign on the device. Complete agreements are locked and downloadable.
 */
export default async function AgreementPage({ params }: PageProps<"/admin/patients/[id]/agreement">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const found = await loadAgreement(id, admin.practiceId, admin.name);
  if (!found) notFound();
  const { patient, agreement, details, sections, started } = found;
  const lh = await practiceLetterhead(admin.practiceId);
  const status = agreementStatus(agreement);
  const contact = [lh.letterhead.address, lh.letterhead.phone, lh.letterhead.email].filter((x) => x.trim()).join(" · ");
  const signerName = details.signer.kind === "responsible" && details.signer.name ? `${details.signer.name} (${details.signer.relationship})` : patient.fullName;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: `/admin/patients/${patient.id}`, label: "Patient" }}
        overline={isComplete(status) ? (status === "refused" ? "Refused to sign" : "Fully signed") : "Both of you sign"}
        title="Service agreement"
        description={`Between ${lh.practiceName} and ${patient.fullName}.`}
        actions={
          isComplete(status) ? (
            <Button variant="outline" nativeButton={false} render={<a href={`/api/agreements/${patient.id}/pdf`} target="_blank" rel="noopener" />}>
              <Download aria-hidden /> Download PDF
            </Button>
          ) : undefined
        }
      />

      {!started ? (
        <AgreementForm
          patientId={patient.id}
          patient={{ name: patient.fullName, dob: patient.dateOfBirth, referralDate: patient.referralDate }}
          practiceName={lh.practiceName}
          clauses={await practiceAgreementClauses(admin.practiceId)}
          initial={details}
        />
      ) : (
        <div className="grid max-w-4xl gap-6">
          <AgreementDocument
            practiceName={lh.practiceName}
            logoUrl={lh.logoUrl}
            contact={contact}
            patient={{ name: patient.fullName, dob: patient.dateOfBirth, referralDate: patient.referralDate }}
            details={details}
            sections={sections.map((s, i) => ({ id: `s${i}`, h: s.h, text: s.text }))}
            client={
              agreement?.refused
                ? { label: "Client", name: patient.fullName, image: null, at: null, note: "Refused to sign" }
                : {
                    label: details.signer.kind === "responsible" ? "Responsible party" : "Client",
                    name: signerName,
                    image: agreement?.patientSignature ?? null,
                    at: agreement?.patientSignedAt?.toISOString() ?? null,
                  }
            }
            witness={{ label: "Agency witness", name: agreement?.adminSignedName ?? details.witnessName, image: agreement?.adminSignature ?? null, at: agreement?.adminSignedAt?.toISOString() ?? null }}
          />
          {!isComplete(status) && (
            <FinishSigning
              patientId={patient.id}
              need={agreement?.patientSignature || agreement?.refused ? "witness" : "client"}
              name={agreement?.patientSignature || agreement?.refused ? details.witnessName || admin.name : signerName}
            />
          )}
        </div>
      )}
    </div>
  );
}
