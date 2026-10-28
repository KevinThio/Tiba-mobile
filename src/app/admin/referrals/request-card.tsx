"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RelativeDay } from "@/components/relative-day";
import { Button } from "@/components/ui/button";
import { confirmReferralRequest, turnOffReferralAccount } from "./actions";

/** A referral source asking to join: who they are and where from, to confirm or decline. */
export function ReferralRequestCard({
  request,
}: {
  request: { id: string; name: string; email: string; organisation: string | null; createdAt: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);

  async function act(kind: "confirm" | "decline") {
    setBusy(kind);
    const run = kind === "confirm" ? confirmReferralRequest : turnOffReferralAccount;
    const result = await run({ accountId: request.id }).catch(() => null);
    setBusy(null);
    if (!result?.ok) return void toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
    toast.success(kind === "confirm" ? `${request.name} can now send you referrals.` : "Request declined. We've emailed them to contact you directly.");
    router.refresh();
  }

  return (
    <li className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{request.name}</p>
          <p className="text-small text-muted-foreground">
            {request.organisation ?? "No organisation"} · {request.email}
          </p>
        </div>
        <span className="text-caption text-muted-foreground">
          Asked <RelativeDay iso={request.createdAt} withTime />
        </span>
      </div>
      <p className="text-small text-muted-foreground">
        Only confirm people you work with. They&apos;ll be able to send you messages and documents, and read your replies.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => act("confirm")} disabled={busy !== null}>
          {busy === "confirm" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Confirm
        </Button>
        <Button variant="outline" onClick={() => act("decline")} disabled={busy !== null}>
          {busy === "decline" ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
          Decline
        </Button>
      </div>
    </li>
  );
}
