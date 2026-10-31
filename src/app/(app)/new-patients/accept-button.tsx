"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptPatient } from "./actions";

export function AcceptButton({ offerId, name }: { offerId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await acceptPatient({ offerId }).catch(() => null);
          if (!result) return void toast.error("We couldn't accept just now. Check your connection and try again.");
          if (!result.ok) {
            toast.error(result.message);
            return router.refresh();
          }
          toast.success(`${result.name} is your patient now.`);
          router.push(`/patients/${result.patientId}`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
      Accept {name.split(" ")[0]}
    </Button>
  );
}
