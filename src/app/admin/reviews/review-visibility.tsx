"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { setReviewHidden } from "./actions";

/** Hide a review (asks first) or show a hidden one again. Reviews can never be deleted. */
export function ReviewVisibility({ reviewId, hidden }: { reviewId: string; hidden: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function apply(next: boolean) {
    startTransition(async () => {
      const result = await setReviewHidden({ reviewId, hidden: next }).catch(() => null);
      if (!result?.ok) {
        toast.error(result?.message ?? "We couldn't save that change. Check your connection and try again.");
        return;
      }
      setConfirming(false);
      toast.success(next ? "Review hidden. You can show it again from Hidden reviews." : "Review shown again.");
    });
  }

  if (hidden) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => apply(false)}>
        <Eye aria-hidden />
        Show again
      </Button>
    );
  }

  return (
    <Dialog open={confirming} onOpenChange={setConfirming}>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        <EyeOff aria-hidden />
        Hide
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hide this review?</DialogTitle>
          <DialogDescription>
            It moves to Hidden reviews and stops counting towards your average. Reviews can&apos;t be deleted, so you can
            show it again at any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep showing</DialogClose>
          <Button disabled={pending} onClick={() => apply(true)}>
            Hide review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
