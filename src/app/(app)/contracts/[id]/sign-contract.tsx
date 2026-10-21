"use client";

import { Loader2, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { markContractSeenByClinician, signContract } from "../actions";

/** Marks the contract seen once it's been shown (not during render). */
export function MarkSeen({ contractId }: { contractId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markContractSeenByClinician(contractId).catch(() => {});
  }, [contractId]);
  return null;
}

/** Your signature pad and Sign and send back. */
export function SignContract({ contractId, name, adminFirst }: { contractId: string; name: string; adminFirst: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sign() {
    if (!signature) return setError("Add your signature to sign.");
    setBusy(true);
    setError(null);
    const result = await signContract({ contractId, signature }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return setError(result?.message ?? "We couldn't sign it just now. Check your connection and try again.");
    toast.success(`Signed and sent back to ${adminFirst}. A copy is in your profile.`);
    router.refresh();
  }

  return (
    <section className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
      <h2 className="text-h3">Your signature</h2>
      <SignaturePad
        label="Sign here"
        name={name}
        invalid={Boolean(error)}
        onChange={(v) => {
          setSignature(v);
          if (v && error) setError(null);
        }}
      />
      <p className="text-small text-muted-foreground">Signing sends it straight back to {adminFirst}. A copy goes to your profile.</p>
      {error && <FormAlert>{error}</FormAlert>}
      <Button onClick={sign} disabled={busy} className="w-fit">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
        Sign and send back
      </Button>
    </section>
  );
}
