"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { saveAgreementSignatures } from "../../actions";

const STAMP = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** A signature that's already given: locked, with the name and when. */
export function SignedTile({ label, name, image, at }: { label: string; name: string; image: string; at: string }) {
  return (
    <figure className="grid gap-2 rounded-md bg-secondary p-4">
      <figcaption className="text-overline font-semibold text-muted-foreground uppercase">{label}</figcaption>
      <div className="flex h-24 items-end justify-center border-b border-border-strong">
        {/* eslint-disable-next-line @next/next/no-img-element -- a stored data URL, not optimisable */}
        <img src={image} alt={`${name}'s signature`} className="max-h-full w-auto max-w-full object-contain" />
      </div>
      <p className="flex flex-wrap justify-between gap-x-3 text-small">
        <span className="font-semibold">{name}</span>
        <span className="text-muted-foreground">{STAMP.format(new Date(at))}</span>
      </p>
    </figure>
  );
}

/** Patient and practice admin signature pads (or the signature already given), then Save signatures. */
export function AgreementSigning({
  patientId,
  patientName,
  adminName,
  signedPatient,
  signedAdmin,
}: {
  patientId: string;
  patientName: string;
  adminName: string;
  signedPatient: { image: string; at: string } | null;
  signedAdmin: { image: string; at: string; name: string } | null;
}) {
  const router = useRouter();
  const [patientSig, setPatientSig] = useState<string | null>(null);
  const [adminSig, setAdminSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = patientName.split(" ")[0];

  async function save() {
    if (!patientSig && !adminSig) return setError("Add a signature first: the patient's, yours, or both.");
    setBusy(true);
    setError(null);
    const result = await saveAgreementSignatures({ patientId, patientSignature: patientSig, adminSignature: adminSig }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save the signatures. Check your connection and try again.");
    toast.success(result.complete ? "Fully signed. The agreement is locked and ready to download." : "Signature saved. The other signature is still needed.");
    router.refresh();
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {signedPatient ? (
          <SignedTile label="Patient" name={patientName} image={signedPatient.image} at={signedPatient.at} />
        ) : (
          <div className="grid gap-2">
            <SignaturePad label="Patient" name={patientName} onChange={setPatientSig} />
            <p className="text-caption text-muted-foreground">Hand the device to {first} to sign.</p>
          </div>
        )}
        {signedAdmin ? (
          <SignedTile label="Practice admin" name={signedAdmin.name} image={signedAdmin.image} at={signedAdmin.at} />
        ) : (
          <SignaturePad label="Practice admin" name={adminName} onChange={setAdminSig} />
        )}
      </div>
      <p className="text-small text-muted-foreground">
        Signatures can&apos;t be changed once saved. When both of you have signed, the agreement is locked and can be downloaded.
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <Button onClick={save} disabled={busy} className="w-fit">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        Save signatures
      </Button>
    </div>
  );
}
