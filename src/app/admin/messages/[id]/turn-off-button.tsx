"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { turnOffPortalAccount } from "../actions";

/** Turns off a patient's portal access (they can't send or read messages any more). Asks first. */
export function TurnOffButton({ accountId, name }: { accountId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function turnOff() {
    if (!window.confirm(`Turn off portal access for ${name}? They won't be able to send or read messages.`)) return;
    setBusy(true);
    const result = await turnOffPortalAccount({ accountId }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return void toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
    toast.success(`Portal access for ${name} is turned off.`);
    router.refresh();
  }
  return (
    <Button variant="outline" onClick={turnOff} disabled={busy}>
      {busy && <Loader2 className="animate-spin" aria-hidden />}
      Turn off access
    </Button>
  );
}
