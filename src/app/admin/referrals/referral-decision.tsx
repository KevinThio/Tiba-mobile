"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { REFERRAL_LIMITS } from "@/lib/referral-status";
import { decideReferralRequest } from "./actions";

type Decision = "accepted" | "declined";

/**
 * Accept or Decline on a waiting referral. Choosing one asks for an optional note (the referral
 * source sees it, e.g. why it was declined or what happens next) before it's saved.
 */
export function ReferralDecision({ referralId, patientName }: { referralId: string; patientName: string }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!choice) return;
    setBusy(true);
    const result = await decideReferralRequest({ referralId, decision: choice, note }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return void toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
    toast.success(choice === "accepted" ? `Referral for ${patientName} accepted.` : `Referral for ${patientName} declined.`);
    setChoice(null);
    router.refresh();
  }

  if (!choice) {
    return (
      <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3">
        <Button onClick={() => setChoice("accepted")}>
          <Check aria-hidden />
          Accept
        </Button>
        <Button variant="outline" onClick={() => setChoice("declined")}>
          <X aria-hidden />
          Decline
        </Button>
      </div>
    );
  }

  const id = `decision-${referralId}`;
  return (
    <div className="grid gap-2 border-t border-border-subtle pt-3">
      <Label htmlFor={id}>{choice === "accepted" ? "Note for the referral source (optional)" : "Why you're declining (optional)"}</Label>
      <textarea
        id={id}
        rows={2}
        autoFocus
        maxLength={REFERRAL_LIMITS.decisionNote}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={choice === "accepted" ? "For example: we'll call the patient this week" : "For example: we don't take this insurance"}
        className="min-h-20 w-full resize-y rounded-md border-[1.5px] border-input bg-card px-3.5 py-3 text-base outline-none placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring"
      />
      <p className="text-small text-muted-foreground">The referral source sees this note and gets an email that their referral was {choice}.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant={choice === "accepted" ? "default" : "destructive"} onClick={save} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : choice === "accepted" ? <Check aria-hidden /> : <X aria-hidden />}
          {choice === "accepted" ? "Accept referral" : "Decline referral"}
        </Button>
        <Button variant="ghost" onClick={() => setChoice(null)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
