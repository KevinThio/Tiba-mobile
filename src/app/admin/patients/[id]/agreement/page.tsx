import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PracticeMark } from "@/components/practice-mark";
import { Button } from "@/components/ui/button";
import { agreementStatus, loadAgreement } from "@/lib/agreements";
import { requireAdmin } from "@/lib/auth";
import { practiceLetterhead } from "@/lib/contract-data";
import { AgreementSigning, SignedTile } from "./agreement-signing";

/**
 * Service agreement (spec v2 section 5 and the prototype): filled from the patient and practice
 * details; the patient and the admin both sign on the device ("Save signatures"); downloadable as
 * a PDF once fully signed, and locked.
 */
export default async function AgreementPage({ params }: PageProps<"/admin/patients/[id]/agreement">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const found = await loadAgreement(id, admin.practiceId);
  if (!found) notFound();
  const { patient, agreement, sections, parties } = found;
  const lh = await practiceLetterhead(admin.practiceId);
  const status = agreementStatus(agreement);
  const contact = [lh.letterhead.address, lh.letterhead.phone, lh.letterhead.email].filter((x) => x.trim());

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: `/admin/patients/${patient.id}`, label: "Patient" }}
        overline={status === "signed" ? "Fully signed" : "Both of you sign"}
        title="Service agreement"
        actions={
          status === "signed" ? (
            <Button variant="outline" nativeButton={false} render={<a href={`/api/agreements/${patient.id}/pdf`} target="_blank" rel="noopener" />}>
              <Download aria-hidden /> Download PDF
            </Button>
          ) : undefined
        }
      />

      <article className="grid w-full max-w-3xl gap-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-8">
        <header className="flex items-center gap-4 border-b border-border-subtle pb-5">
          <PracticeMark practiceName={lh.practiceName} logoUrl={lh.logoUrl} />
          <div className="min-w-0">
            <p className="font-heading text-xl leading-tight text-primary">{lh.practiceName}</p>
            {contact.length > 0 && <p className="text-small break-words text-muted-foreground">{contact.join(" · ")}</p>}
          </div>
        </header>
        <div className="grid gap-1">
          <h2 className="text-h2">Service agreement</h2>
          <p className="text-small text-muted-foreground">{parties}</p>
        </div>
        {sections.map((sec) => (
          <div key={sec.h} className="grid gap-1">
            <h3 className="font-sans text-body font-semibold text-primary">{sec.h}</h3>
            <p className="break-words">{sec.text}</p>
          </div>
        ))}
        <p className="text-caption text-muted-foreground">Draft wording. Swap in your agreement outline when it&apos;s ready.</p>
      </article>

      {status === "signed" ? (
        <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          <SignedTile label="Patient" name={patient.fullName} image={agreement!.patientSignature!} at={agreement!.patientSignedAt!.toISOString()} />
          <SignedTile label="Practice admin" name={agreement!.adminSignedName ?? admin.name} image={agreement!.adminSignature!} at={agreement!.adminSignedAt!.toISOString()} />
        </div>
      ) : (
        <AgreementSigning
          patientId={patient.id}
          patientName={patient.fullName}
          adminName={admin.name}
          signedPatient={agreement?.patientSignature ? { image: agreement.patientSignature, at: agreement.patientSignedAt!.toISOString() } : null}
          signedAdmin={agreement?.adminSignature ? { image: agreement.adminSignature, at: agreement.adminSignedAt!.toISOString(), name: agreement.adminSignedName ?? admin.name } : null}
        />
      )}
    </div>
  );
}
