"use client";

import { ImagePlus, Loader2, Save, Send, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { ContractDocument } from "@/components/contract-document";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ContractTerms, Letterhead } from "@/db/schema";
import { CONTRACT_LENGTHS, CONTRACT_TYPES, contractSections, type ContractType } from "@/lib/contracts";
import { saveContract, type ContractInput } from "./actions";

const IMAGE_MAX_PX = 1600;
const IMAGE_MAX_LENGTH = 900_000;

/** Resizes a letterhead image in the browser to a PNG (or JPEG if that's smaller than the limit). */
async function resizeLetterhead(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_PX / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL("image/png");
  if (png.length <= IMAGE_MAX_LENGTH) return png;
  for (const q of [0.85, 0.7, 0.55]) {
    const jpeg = canvas.toDataURL("image/jpeg", q);
    if (jpeg.length <= IMAGE_MAX_LENGTH) return jpeg;
  }
  throw new Error("too big");
}

type Props = {
  id?: string;
  label: string;
  status?: "draft" | "sent" | "feedback";
  practiceName: string;
  adminName: string;
  logoUrl: string | null;
  clinicians: { id: string; name: string }[];
  initial: { clinicianId: string; type: ContractType; terms: ContractTerms };
  letterhead: Letterhead;
};

/**
 * New contract, Continue editing, and Update and resend (spec v2 section 5c and the prototype):
 * the terms, the practice letterhead, a live preview and the admin's signature.
 */
export function ContractForm({ id, label, status, practiceName, adminName, logoUrl, clinicians, initial, letterhead: savedLetterhead }: Props) {
  const router = useRouter();
  const [clinicianId, setClinicianId] = useState(initial.clinicianId);
  const [type, setType] = useState<ContractType>(initial.type);
  const [terms, setTerms] = useState(initial.terms);
  const [letterhead, setLetterhead] = useState(savedLetterhead);
  const [imageChanged, setImageChanged] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const clinicianName = clinicians.find((c) => c.id === clinicianId)?.name ?? "";
  const first = clinicianName.split(" ")[0] || "the clinician";
  const setT = (patch: Partial<ContractTerms>) => {
    setTerms((t) => ({ ...t, ...patch }));
    if (error) setError(null);
  };
  const canDraft = !status || status === "draft";

  async function submit(mode: "draft" | "send") {
    if (!clinicianId) return setError("Pick the clinician.");
    if (mode === "send" && !signature) return setError("Sign the contract before you send it.");
    setBusy(mode);
    setError(null);
    const result = await saveContract({
      id,
      clinicianId,
      type,
      terms: terms as ContractInput["terms"],
      letterhead: { address: letterhead.address, phone: letterhead.phone, email: letterhead.email, image: imageChanged ? letterhead.image : undefined },
      mode,
      signature,
    }).catch(() => null);
    setBusy(null);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save the contract. Check your connection and try again.");
    toast.success(mode === "send" ? `Sent. ${first} can sign it from their Contracts.` : "Draft saved. Only you can see it.");
    router.push(`/admin/contracts/${result.id}`);
    router.refresh();
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    try {
      const image = await resizeLetterhead(file);
      setLetterhead((l) => ({ ...l, image }));
      setImageChanged(true);
    } catch {
      toast.error("We couldn't use that image. Try a smaller PNG or JPG.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="grid gap-6">
        <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Contract</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="clinician">Clinician</Label>
              <NativeSelect id="clinician" className="w-full" value={clinicianId} onChange={(e) => setClinicianId(e.target.value)}>
                <NativeSelectOption value="">Pick a clinician</NativeSelectOption>
                {clinicians.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <NativeSelect id="type" className="w-full" value={type} onChange={(e) => setType(e.target.value as ContractType)}>
                {CONTRACT_TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {t}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <FormField label="Start date" name="start" type="date" value={terms.start} onChange={(e) => setT({ start: e.target.value })} className="sm:max-w-60" />
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Length</legend>
            <div role="radiogroup" aria-label="Length" className="flex flex-wrap gap-2">
              {CONTRACT_LENGTHS.map((l) => (
                <ChoiceChip key={l} single size="sm" on={terms.length === l} onClick={() => setT({ length: l })}>
                  {l}
                </ChoiceChip>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Pay" name="pay" value={terms.pay} onChange={(e) => setT({ pay: e.target.value })} placeholder="e.g. $90 per visit" />
            <FormField label="Role or services" name="role" value={terms.role} onChange={(e) => setT({ role: e.target.value })} placeholder="e.g. physical therapy" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="extra">Other terms (optional)</Label>
            <Textarea id="extra" rows={3} maxLength={3000} value={terms.extra} onChange={(e) => setT({ extra: e.target.value })} placeholder="e.g. Up to 20 visits a week." />
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-h3">Letterhead</h2>
            <p className="text-small text-muted-foreground">Used on every contract you send.</p>
          </div>
          {!logoUrl && !letterhead.image && (
            <p className="flex gap-2 rounded-md bg-warning px-4 py-3 text-small text-warning-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Your practice has no logo yet, so your initials show. Add one in Settings.
            </p>
          )}
          <FormField label="Address" name="address" value={letterhead.address} onChange={(e) => setLetterhead({ ...letterhead, address: e.target.value })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Phone" name="phone" type="tel" value={letterhead.phone} onChange={(e) => setLetterhead({ ...letterhead, phone: e.target.value })} />
            <FormField label="Email" name="email" type="email" value={letterhead.email} onChange={(e) => setLetterhead({ ...letterhead, email: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pickImage(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus aria-hidden /> {letterhead.image ? "Change letterhead image" : "Upload letterhead image"}
            </Button>
            {letterhead.image && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLetterhead({ ...letterhead, image: null });
                  setImageChanged(true);
                }}
              >
                <Trash2 aria-hidden /> Remove image
              </Button>
            )}
          </div>
          <p className="text-small text-muted-foreground">Optional: upload your own letterhead image to replace the text version.</p>
        </section>

        <section className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Your signature</h2>
          <SignaturePad label="Sign here, then send" name={adminName} onChange={setSignature} />
          <p className="text-small text-muted-foreground">
            Sending shares it to {first}&apos;s Contracts and notifications.
            {status && status !== "draft" && " They'll be asked to sign the updated version."}
          </p>
        </section>

        {error && <FormAlert>{error}</FormAlert>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => submit("send")} disabled={busy !== null}>
            {busy === "send" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {status && status !== "draft" ? "Update and resend" : "Sign and send"}
          </Button>
          {canDraft && (
            <Button variant="outline" onClick={() => submit("draft")} disabled={busy !== null}>
              {busy === "draft" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              Save draft
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-2 lg:sticky lg:top-6">
        <p className="text-overline font-semibold text-muted-foreground uppercase">Live preview</p>
        <ContractDocument
          practiceName={practiceName}
          logoUrl={logoUrl}
          letterhead={letterhead}
          label={label}
          type={type}
          clinicianName={clinicianName}
          sections={contractSections(type, terms, clinicianName, practiceName)}
          admin={{ label: "Practice admin", name: adminName, image: signature, at: signature ? new Date().toISOString() : null }}
          clinician={{ label: "Clinician", name: clinicianName || "Clinician", image: null, at: null }}
        />
      </div>
    </div>
  );
}
