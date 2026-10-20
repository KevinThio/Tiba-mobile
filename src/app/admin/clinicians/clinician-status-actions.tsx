"use client";

import { UserCheck, UserX } from "lucide-react";
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
import { setClinicianStatus } from "./actions";

type Status = "pending" | "active" | "deactivated";

/** Activate (verify), decline, deactivate or reactivate one clinician. */
export function ClinicianStatusActions({ clinicianId, name, status }: { clinicianId: string; name: string; status: Status }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const first = name.split(" ")[0];

  function apply(next: "active" | "deactivated", done: string) {
    startTransition(async () => {
      const result = await setClinicianStatus({ clinicianId, status: next }).catch(() => null);
      if (!result?.ok) {
        toast.error(result?.message ?? "We couldn't save that change. Check your connection and try again.");
        return;
      }
      setConfirming(false);
      toast.success(done);
    });
  }

  if (status === "pending") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => apply("active", `${first} is verified and can sign in.`)}>
          <UserCheck aria-hidden />
          Activate
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => apply("deactivated", `${first} stays inactive. You can activate them later.`)}
        >
          Not now
        </Button>
      </div>
    );
  }

  if (status === "deactivated") {
    return (
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => apply("active", `${first}'s account is active again.`)}>
        <UserCheck aria-hidden />
        Activate
      </Button>
    );
  }

  return (
    <Dialog open={confirming} onOpenChange={setConfirming}>
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
        <UserX aria-hidden />
        Deactivate
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {name}?</DialogTitle>
          <DialogDescription>
            They&apos;re signed out straight away and can&apos;t see patients. Their notes are kept, and you can turn the
            account back on at any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep active</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => apply("deactivated", `${first}'s account is deactivated.`)}
          >
            Deactivate account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
