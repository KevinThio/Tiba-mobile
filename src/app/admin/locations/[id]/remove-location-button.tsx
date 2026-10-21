"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeLocation } from "../actions";

/** Remove location: asks to confirm; disabled for the last location. */
export function RemoveLocationButton({ locationId, name, last }: { locationId: string; name: string; last: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={last || pending}
      title={last ? "Your only location can't be removed." : undefined}
      onClick={() => {
        if (!window.confirm(`Remove ${name}? Its files are removed too. This can't be undone.`)) return;
        startTransition(async () => {
          const result = await removeLocation({ locationId }).catch(() => null);
          if (!result?.ok) return void toast.error(result?.message ?? "We couldn't remove it. Check your connection and try again.");
          toast.success(`${name} is removed.`);
          router.push("/admin/locations");
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />} Remove location
    </Button>
  );
}
