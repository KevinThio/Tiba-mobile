"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { removeLocation } from "../actions";

/**
 * Remove location: asks to confirm and, when clinicians are based there, which location they move
 * to. Disabled for the last location.
 */
export function RemoveLocationButton({
  locationId,
  name,
  clinicianCount,
  otherLocations,
}: {
  locationId: string;
  name: string;
  clinicianCount: number;
  otherLocations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moveToId, setMoveToId] = useState(otherLocations.length === 1 ? otherLocations[0].id : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const last = otherLocations.length === 0;

  function remove() {
    if (clinicianCount > 0 && !moveToId) return setError("Pick the location its clinicians move to.");
    setError(null);
    startTransition(async () => {
      const result = await removeLocation({ locationId, moveToId: moveToId || null }).catch(() => null);
      if (!result?.ok) return setError(result?.message ?? "We couldn't remove it. Check your connection and try again.");
      toast.success(`${name} is removed.`);
      router.push("/admin/locations");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" disabled={last} title={last ? "Your only location can't be removed." : undefined} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Remove location
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {name}?</DialogTitle>
          <DialogDescription>Its files are removed too. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        {clinicianCount > 0 && (
          <div className="grid gap-2">
            <Label htmlFor="move-to">
              Move its {clinicianCount === 1 ? "clinician" : `${clinicianCount} clinicians`} to
            </Label>
            <NativeSelect
              id="move-to"
              className="w-full"
              value={moveToId}
              onChange={(e) => {
                setMoveToId(e.target.value);
                setError(null);
              }}
            >
              <NativeSelectOption value="">Choose a location</NativeSelectOption>
              {otherLocations.map((l) => (
                <NativeSelectOption key={l.id} value={l.id}>
                  {l.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
        {error && <FormAlert>{error}</FormAlert>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep it</DialogClose>
          <Button variant="destructive" disabled={pending} onClick={remove}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Remove location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
