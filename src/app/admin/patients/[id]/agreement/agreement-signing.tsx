"use client";

import { Loader2, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { saveAgreementSignatures } from "../../agreement-actions";

/** After one side has signed: the remaining signature pad (the wording and details are fixed). */
export function FinishSigning({ patientId, need, name }: { patientId: string; need: "client" | "witness"; name: string }) {
  const router = useRouter();
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!sig) return setError("Add the signature first.");
    setBusy(true);
    setError(null);
    const result = await saveAgreementSignatures({
      patientId,
      details: null,
      clientSignature: need === "client" ? sig : null,
      witnessSignature: need === "witness" ? sig : null,
    }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save the signature. Check your connection and try again.");
    toast.success(result.complete ? "Done. The agreement is complete and locked." : "Signature saved.");
    router.refresh();
  }

  return (
    <section className="grid max-w-xl gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
      <h2 className="text-h3">{need === "client" ? "Client's signature" : "Agency witness's signature"}</h2>
      <SignaturePad label={need === "client" ? "Client" : "Agency witness"} name={name} onChange={setSig} />
      {need === "client" && <p className="text-caption text-muted-foreground">Hand the device over to sign.</p>}
      {error && <FormAlert>{error}</FormAlert>}
      <Button onClick={save} disabled={busy} className="w-fit">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
        Save signature
      </Button>
    </section>
  );
}
