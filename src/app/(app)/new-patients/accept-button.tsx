"use client";

import { Check, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptPatient, withdrawPatient } from "./actions";

/** Accept a patient, or take it back while the admin hasn't assigned them yet. */
export function AcceptButton({ offerId, name, accepted }: { offerId: string; name: string; accepted: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const first = name.split(" ")[0];

  function run() {
    startTransition(async () => {
      const result = await (accepted ? withdrawPatient({ offerId }) : acceptPatient({ offerId })).catch(() => null);
      if (!result) return void toast.error("We couldn't save that just now. Check your connection and try again.");
      if (!result.ok) toast.error(result.message);
      else toast.success(accepted ? `You took back your acceptance for ${first}.` : `You accepted ${first}. Your admin will assign them and let you know.`);
      router.refresh();
    });
  }

  return (
    <Button variant={accepted ? "outline" : "default"} disabled={pending} onClick={run}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : accepted ? <Undo2 aria-hidden /> : <Check aria-hidden />}
      {accepted ? "Take back" : `Accept ${first}`}
    </Button>
  );
}
