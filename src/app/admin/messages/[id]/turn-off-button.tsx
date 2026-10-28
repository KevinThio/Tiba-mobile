"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Turns off a patient's or referral source's portal access (they can't send or read messages any
 * more). Asks first. `turnOff` is the screen's Server Action.
 */
export function TurnOffButton({
  accountId,
  name,
  turnOff,
}: {
  accountId: string;
  name: string;
  turnOff: (input: { accountId: string }) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function confirmTurnOff() {
    if (!window.confirm(`Turn off portal access for ${name}? They won't be able to send or read messages.`)) return;
    setBusy(true);
    const result = await turnOff({ accountId }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return void toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
    toast.success(`Portal access for ${name} is turned off.`);
    router.refresh();
  }
  return (
    <Button variant="outline" onClick={confirmTurnOff} disabled={busy}>
      {busy && <Loader2 className="animate-spin" aria-hidden />}
      Turn off access
    </Button>
  );
}
