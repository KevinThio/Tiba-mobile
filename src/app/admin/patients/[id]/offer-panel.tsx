"use client";

import { Loader2, Megaphone, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { OFFER_FOR, SERVICES, type Service } from "@/lib/patient-options";
import { assignOfferedPatient, offerToClinicians, withdrawOffer } from "../offer-actions";

type OpenOffer = {
  id: string;
  service: Service;
  offeredTo: number;
  offeredAt: string;
  responses: { clinicianId: string; name: string; active: boolean; acceptedAt: string }[];
};

/**
 * Offer to clinicians, on the admin's patient page: send the patient to every clinician who does
 * a type of care, see who accepted (first first) and assign one of them.
 */
export function OfferPanel({
  patientId,
  first,
  active,
  open,
  counts,
  lastAssigned,
}: {
  patientId: string;
  first: string;
  active: boolean;
  open: OpenOffer | null;
  counts: Record<Service, number>;
  lastAssigned: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [service, setService] = useState<Service | "">("");
  const [error, setError] = useState<string | null>(null);

  function run(key: string, action: () => Promise<{ ok: true } | { ok: false; message: string }>, done: string) {
    setBusy(key);
    setError(null);
    startTransition(async () => {
      const result = await action().catch(() => null);
      setBusy(null);
      if (!result) return setError("We couldn't save that just now. Check your connection and try again.");
      if (!result.ok) return setError(result.message);
      toast.success(done);
      router.refresh();
    });
  }

  if (open) {
    const words = OFFER_FOR[open.service];
    const firstActive = open.responses.find((r) => r.active);
    return (
      <div className="grid gap-4">
        <div role="status" className="flex gap-3 rounded-md bg-info px-4 py-3.5 text-info-foreground">
          <Megaphone className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">
              Offered for {words.care} to {open.offeredTo} {open.offeredTo === 1 ? "clinician" : words.who},{" "}
              <RelativeDay iso={open.offeredAt} withTime />.
            </span>{" "}
            {open.responses.length
              ? `Assign ${first} to one of the clinicians who accepted. The first to accept is suggested.`
              : "Nobody has accepted yet. We'll email you when someone does."}
          </p>
        </div>
        {open.responses.length > 0 && (
          <ol className="grid grid-cols-1 rounded-md border border-border-subtle">
            {open.responses.map((r, i) => (
              <li key={r.clinicianId} className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.name}
                    {i === 0 && <Badge variant="success">First to accept</Badge>}
                    {!r.active && <Badge variant="neutral">Not active</Badge>}
                  </p>
                  <p className="text-small text-muted-foreground">
                    Accepted <RelativeDay iso={r.acceptedAt} withTime />
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={r.clinicianId === firstActive?.clinicianId ? "default" : "outline"}
                  disabled={pending || !r.active}
                  onClick={() =>
                    run(
                      r.clinicianId,
                      () => assignOfferedPatient({ offerId: open.id, clinicianId: r.clinicianId }),
                      `${first} is assigned to ${r.name}. We've told them.`,
                    )
                  }
                >
                  {busy === r.clinicianId ? <Loader2 className="animate-spin" aria-hidden /> : <UserCheck aria-hidden />}
                  Assign to {r.name.split(" ")[0]}
                </Button>
              </li>
            ))}
          </ol>
        )}
        {error && <FormAlert>{error}</FormAlert>}
        <Button
          variant="ghost"
          className="w-fit"
          disabled={pending}
          onClick={() => run("withdraw", () => withdrawOffer({ patientId }), "The offer is withdrawn.")}
        >
          {busy === "withdraw" && <Loader2 className="animate-spin" aria-hidden />}
          Withdraw offer
        </Button>
      </div>
    );
  }

  if (!active) return <p className="text-small text-muted-foreground">Reactivate {first} to offer them to your clinicians.</p>;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!service) return setError("Pick the type of care to offer.");
        run(
          "offer",
          async () => {
            const result = await offerToClinicians({ patientId, service });
            return result.ok ? { ok: true as const } : result;
          },
          `${first} is offered to your ${OFFER_FOR[service].who}. We'll tell you who accepts.`,
        );
      }}
    >
      {lastAssigned && <p className="text-small text-muted-foreground">Last offer: assigned to {lastAssigned}.</p>}
      <p className="text-muted-foreground">
        Send {first} to every clinician who does a type of care. Those who can take them accept, and you assign one, usually the
        first.
      </p>
      <div className="grid gap-2">
        <Label htmlFor="offer-service">Type of care</Label>
        <NativeSelect id="offer-service" className="w-full" value={service} onChange={(e) => setService(e.target.value as Service | "")}>
          <NativeSelectOption value="">Pick the type of care</NativeSelectOption>
          {SERVICES.map((s) => (
            <NativeSelectOption key={s.value} value={s.value} disabled={counts[s.value] === 0}>
              {s.label} · {counts[s.value] === 0 ? "nobody yet" : `${counts[s.value]} ${counts[s.value] === 1 ? "clinician" : "clinicians"}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <Button type="submit" className="w-fit" disabled={pending}>
        {busy === "offer" ? <Loader2 className="animate-spin" aria-hidden /> : <Megaphone aria-hidden />}
        Offer to clinicians
      </Button>
    </form>
  );
}
