"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { confirmPortalRequest, turnOffPortalAccount } from "./actions";

type Record = { id: string; fullName: string; dateOfBirth: string };

const BORN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const born = (iso: string) => BORN.format(new Date(`${iso}T00:00:00Z`));

/**
 * Someone asking for patient portal access: what they gave (name, date of birth, email) and the
 * patient record to link. A record whose name and date of birth match is picked for the admin;
 * otherwise they choose one, or decline.
 */
export function RequestCard({
  request,
  matches,
  others,
}: {
  request: { id: string; name: string; email: string; birthDate: string | null; createdAt: string };
  matches: Record[];
  others: Record[];
}) {
  const router = useRouter();
  // Pre-pick only a single clear match; with several, the admin chooses.
  const [patientId, setPatientId] = useState(matches.length === 1 ? matches[0].id : "");
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);

  async function confirm() {
    setBusy("confirm");
    const result = await confirmPortalRequest({ accountId: request.id, patientId }).catch(() => null);
    setBusy(null);
    if (!result?.ok) return void toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
    toast.success(`${request.name} can now message you.`);
    router.refresh();
  }

  async function decline() {
    setBusy("decline");
    const result = await turnOffPortalAccount({ accountId: request.id }).catch(() => null);
    setBusy(null);
    if (!result?.ok) return void toast.error(result?.message ?? "We couldn't save that. Check your connection and try again.");
    toast.success("Request declined. We've emailed them to contact you directly.");
    router.refresh();
  }

  return (
    <li className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{request.name}</p>
          <p className="text-small text-muted-foreground">
            {request.birthDate ? `Born ${born(request.birthDate)}` : "No date of birth"} · {request.email}
          </p>
        </div>
        <span className="text-caption text-muted-foreground">
          Asked <RelativeDay iso={request.createdAt} withTime />
        </span>
      </div>
      {matches.length ? (
        <Badge variant="success" className="w-fit">
          Matches {matches.length === 1 ? "a patient record" : `${matches.length} patient records`}
        </Badge>
      ) : (
        <Badge variant="warning" className="w-fit">
          No record matches this name and date of birth
        </Badge>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`record-${request.id}`}>Link to patient record</Label>
        <NativeSelect id={`record-${request.id}`} className="w-full" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <NativeSelectOption value="">Pick the patient…</NativeSelectOption>
          {matches.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.fullName} · born {born(p.dateOfBirth)} (matches)
            </NativeSelectOption>
          ))}
          {others.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.fullName} · born {born(p.dateOfBirth)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-small text-muted-foreground">
          Only confirm if you&apos;re sure it&apos;s your patient. They&apos;ll be able to message you, and read your replies.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={confirm} disabled={!patientId || busy !== null}>
          {busy === "confirm" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Confirm
        </Button>
        <Button variant="outline" onClick={decline} disabled={busy !== null}>
          {busy === "decline" ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
          Decline
        </Button>
      </div>
    </li>
  );
}
