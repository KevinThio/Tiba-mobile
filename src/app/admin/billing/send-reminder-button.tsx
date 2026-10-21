"use client";

import { BellRing, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendBillingReminderNow } from "../notes/actions";

/** Send reminder: emails the admin the notes waiting to be billed. */
export function SendReminderButton({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await sendBillingReminderNow().catch(() => null);
          if (!result?.ok) toast.error(result?.message ?? "We couldn't send the reminder just now. Please try again.");
          else toast.success(`Reminder sent to ${result.to}: ${result.count} ${result.count === 1 ? "note" : "notes"} to bill.`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <BellRing aria-hidden />}
      Send reminder
    </Button>
  );
}
