"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { answerPatientOffer } from "./actions";

type Answer = "accepted" | "declined";

/**
 * Accept or decline an offered patient. Declining asks for an optional reason for the admin.
 * The answer can change until the admin assigns the patient.
 */
export function OfferAnswer({
  offerId,
  name,
  answer,
  reason,
}: {
  offerId: string;
  name: string;
  answer: Answer | null;
  reason: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const first = name.split(" ")[0];

  function send(next: Answer) {
    setError(null);
    startTransition(async () => {
      const result = await answerPatientOffer({ offerId, answer: next, reason: next === "declined" ? why : undefined }).catch(() => null);
      if (!result) return setError("We couldn't send your answer just now. Check your connection and try again.");
      if (!result.ok) {
        toast.error(result.message);
        return router.refresh();
      }
      setDeclining(false);
      toast.success(
        next === "accepted"
          ? `You accepted ${first}. Your admin will assign them and let you know.`
          : `You declined ${first}. We've told your admin.`,
      );
      router.refresh();
    });
  }

  if (declining) {
    return (
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          send("declined");
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor={`why-${offerId}`}>Why can&apos;t you take {first}? (optional)</Label>
          <Textarea
            id={`why-${offerId}`}
            value={why}
            maxLength={300}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="e.g. My caseload is full this month"
          />
          <p className="text-small text-muted-foreground">Only your admin sees this.</p>
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
            Decline {first}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setDeclining(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-3">
      {answer === "accepted" && <Badge variant="success">You accepted · waiting for your admin</Badge>}
      {answer === "declined" && (
        <p className="text-small text-muted-foreground">
          <Badge variant="neutral" className="mr-2">
            You declined
          </Badge>
          {reason}
        </p>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        {answer !== "accepted" && (
          <Button disabled={pending} onClick={() => send("accepted")}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            {answer === "declined" ? "Accept instead" : `Accept ${first}`}
          </Button>
        )}
        {answer !== "declined" && (
          <Button variant="outline" disabled={pending} onClick={() => setDeclining(true)}>
            <X aria-hidden />
            {answer === "accepted" ? "Decline instead" : "Decline"}
          </Button>
        )}
      </div>
    </div>
  );
}
