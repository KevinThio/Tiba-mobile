"use client";

import { CircleCheck, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markNotesBilled } from "./actions";

/** Mark as billed, for one note (or a few). */
export function MarkBilledButton({ appointmentIds, size = "default" }: { appointmentIds: string[]; size?: "default" | "sm" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size={size}
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markNotesBilled({ appointmentIds }).catch(() => null);
          if (!result?.ok) toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
          else toast.success(result.count === 1 ? "Marked as billed." : `${result.count} notes marked as billed.`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
      Mark as billed
    </Button>
  );
}
