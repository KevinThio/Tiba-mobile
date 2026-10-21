"use client";

import { GitMerge, Loader2, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { confirmNewPatient, mergeIntoExisting } from "../../actions";

/** Merge into existing / Confirm new patient. On phones they sit under the comparison instead. */
export function ReviewActions({
  patientId,
  canMerge,
  placement,
}: {
  patientId: string;
  canMerge: boolean;
  placement: "header" | "page";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"merge" | "confirm" | null>(null);

  async function run(kind: "merge" | "confirm") {
    if (
      kind === "merge" &&
      !window.confirm(
        "Merge these records? The visits and notes move to the existing record, and this entry is hidden. This can't be undone.",
      )
    ) {
      return;
    }
    setBusy(kind);
    const result = await (kind === "merge" ? mergeIntoExisting : confirmNewPatient)({ patientId }).catch(() => null);
    if (!result?.ok) {
      setBusy(null);
      toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
      return;
    }
    toast.success(kind === "merge" ? `Merged into ${result.name}'s record.` : `${result.name} is confirmed as a new patient.`);
    router.push("/admin/patients");
    router.refresh();
  }

  return (
    <div className={cn("flex-wrap gap-2", placement === "header" ? "hidden md:flex" : "flex [&>button]:flex-1")}>
      {canMerge && (
        <Button variant="outline" onClick={() => run("merge")} disabled={busy !== null}>
          {busy === "merge" ? <Loader2 className="animate-spin" aria-hidden /> : <GitMerge aria-hidden />}
          Merge into existing
        </Button>
      )}
      <Button onClick={() => run("confirm")} disabled={busy !== null}>
        {busy === "confirm" ? <Loader2 className="animate-spin" aria-hidden /> : <UserCheck aria-hidden />}
        Confirm new patient
      </Button>
    </div>
  );
}
