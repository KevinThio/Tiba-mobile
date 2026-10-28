"use client";

import { Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { AttachButton, UploadList, useUploads, type AttachmentConfig } from "@/components/portal-messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isSelfPay, REFERRAL_LIMITS as L } from "@/lib/referral-status";
import { sendReferral, type ReferralField } from "../actions";

/**
 * Make a referral: the patient's full name, date of birth, insurer (suggestions for the practice's
 * country, or typed) and insurance ID (not needed for self-pay), what they need, and documents.
 */
export function ReferralForm({ insurers, attachments, practiceName }: { insurers: string[]; attachments: AttachmentConfig; practiceName: string }) {
  const router = useRouter();
  const uploads = useUploads(attachments);
  const [insurer, setInsurer] = useState("");
  const [problem, setProblem] = useState<{ field: ReferralField; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const selfPay = isSelfPay(insurer);
  const error = (field: ReferralField) => (problem?.field === field ? problem.message : null);
  const clear = (field: ReferralField) => problem?.field === field && setProblem(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || uploads.uploading) return;
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();
    const input = {
      patientName: get("patientName"),
      birthDate: get("birthDate"),
      insurer: get("insurer"),
      insuranceId: get("insuranceId"),
      note: get("note"),
      attachmentIds: uploads.ready,
    };
    if (!input.patientName) return setProblem({ field: "patientName", message: "Add the patient's full name." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) || input.birthDate > today) return setProblem({ field: "birthDate", message: "Pick the patient's date of birth." });
    if (!input.insurer) return setProblem({ field: "insurer", message: "Add the patient's insurance, or Self-pay." });
    if (!input.insuranceId && !isSelfPay(input.insurer)) return setProblem({ field: "insuranceId", message: "Add the insurance ID (member ID) from their card." });

    setPending(true);
    setProblem(null);
    const result = await sendReferral(input).catch(() => null);
    if (!result?.ok) {
      setPending(false);
      return setProblem(result ? { field: result.field, message: result.message } : { field: "form", message: "We couldn't send that. Check your connection and try again." });
    }
    toast.success(`Referral sent. ${practiceName} will accept or decline it here.`);
    router.push("/referrer");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <fieldset className="grid gap-5">
        <legend className="mb-1 text-h3">The patient</legend>
        <FormField
          label="Patient's full name"
          name="patientName"
          autoComplete="off"
          maxLength={L.patientName}
          hint="As it appears on their insurance card."
          error={error("patientName")}
          onChange={() => clear("patientName")}
        />
        <FormField label="Date of birth" name="birthDate" type="date" min="1900-01-01" max={today} error={error("birthDate")} onChange={() => clear("birthDate")} />
        <FormField
          label="Insurance"
          name="insurer"
          list="insurers"
          autoComplete="off"
          maxLength={L.insurer}
          value={insurer}
          hint="Pick one, or type the name. Choose Self-pay if they pay themselves."
          error={error("insurer")}
          onChange={(e) => {
            setInsurer(e.target.value);
            clear("insurer");
          }}
        />
        <datalist id="insurers">
          {insurers.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
        <FormField
          label={selfPay ? "Insurance ID (optional)" : "Insurance ID"}
          name="insuranceId"
          autoComplete="off"
          maxLength={L.insuranceId}
          hint={selfPay ? "Not needed for self-pay." : "The member ID on their insurance card."}
          error={error("insuranceId")}
          onChange={() => clear("insuranceId")}
        />
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="note">What they need (optional)</Label>
        <textarea
          id="note"
          name="note"
          rows={4}
          maxLength={L.note}
          aria-invalid={error("note") ? true : undefined}
          aria-describedby="note-hint"
          onChange={() => clear("note")}
          placeholder="For example: physical therapy after a knee replacement, twice a week"
          className="min-h-28 w-full resize-y rounded-md border-[1.5px] border-input bg-card px-3.5 py-3 text-base outline-none placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive"
        />
        <p id="note-hint" className={error("note") ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {error("note") ?? "Services, the ordering doctor, or anything the practice should know."}
        </p>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Documents (optional)</p>
        <UploadList uploads={uploads} disabled={pending} />
        <div className="flex flex-wrap items-center gap-2">
          <AttachButton uploads={uploads} disabled={pending} />
          <span className="text-caption text-muted-foreground">
            Referral forms, orders or records. PDF, Word or images, up to {Math.round(attachments.maxBytes / 1024 / 1024)} MB each.
          </span>
        </div>
      </div>

      {problem?.field === "form" && <FormAlert>{problem.message}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending || uploads.uploading}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {pending ? "Sending…" : "Send referral"}
        </Button>
        <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/referrer" />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
