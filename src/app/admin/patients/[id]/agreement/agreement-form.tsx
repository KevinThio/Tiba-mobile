"use client";

import { Loader2, PenLine, Save, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChoiceChip } from "@/components/choice-chip";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { blanksIn, renderClauses, type AgreementClause, type AgreementDetails } from "@/lib/agreement-template";
import { saveAgreementDetails, saveAgreementSignatures } from "../../agreement-actions";

type Props = {
  patientId: string;
  patient: { name: string; dob: string; referralDate: string | null };
  practiceName: string;
  clauses: AgreementClause[];
  initial: AgreementDetails;
};

const DAY = (iso: string | null) =>
  iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "Not added";

function Card({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-h3">{title}</h2>
        {help && <p className="text-small text-muted-foreground">{help}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * The service agreement form (modelled on a home care agency's form): client, emergency contact,
 * insurance, services, rates, deposit, the practice's wording, the client's answers and the
 * signatures. Details can be saved and finished later; signing fixes them.
 */
export function AgreementForm({ patientId, patient, practiceName, clauses, initial }: Props) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [clientSig, setClientSig] = useState<string | null>(null);
  const [witnessSig, setWitnessSig] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "sign" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = patient.name.split(" ")[0];
  const sections = useMemo(() => renderClauses(clauses, { practice: practiceName, client: patient.name, details: d }), [clauses, practiceName, patient.name, d]);
  const blanks = useMemo(() => blanksIn(clauses), [clauses]);
  const refused = d.signer.kind === "refused";

  // Small typed setters for nested parts.
  const set = <K extends keyof AgreementDetails>(key: K, value: AgreementDetails[K]) => {
    setD((cur) => ({ ...cur, [key]: value }));
    if (error) setError(null);
  };
  const part = <K extends "client" | "emergency" | "insurance">(key: K) => (patch: Partial<AgreementDetails[K]>) => set(key, { ...d[key], ...patch });
  const field = <K extends "client" | "emergency" | "insurance">(key: K, name: keyof AgreementDetails[K] & string, label: string, extra: Partial<React.ComponentProps<typeof FormField>> = {}) => (
    <FormField
      label={label}
      name={`${key}-${name}`}
      value={String(d[key][name] ?? "")}
      onChange={(e) => part(key)({ [name]: e.target.value } as Partial<AgreementDetails[K]>)}
      {...extra}
    />
  );
  const addressFields = (key: "client" | "emergency" | "insurance") => (
    <>
      {field(key, "address", "Address")}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {field(key, "city", "City")}
        {field(key, "state", "State or county")}
        {field(key, "zip", "Zip or postal code")}
        {field(key, "phone", "Telephone", { type: "tel" })}
      </div>
    </>
  );

  async function save() {
    setBusy("save");
    setError(null);
    const result = await saveAgreementDetails({ patientId, details: d }).catch(() => null);
    setBusy(null);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save the details. Check your connection and try again.");
    toast.success("Details saved. You can sign it now or later.");
    router.refresh();
  }

  async function sign() {
    setBusy("sign");
    setError(null);
    const result = await saveAgreementSignatures({ patientId, details: d, clientSignature: refused ? null : clientSig, witnessSignature: witnessSig }).catch(() => null);
    setBusy(null);
    if (!result?.ok) return setError(result?.message ?? "We couldn't save the signatures. Check your connection and try again.");
    toast.success(result.complete ? "Done. The agreement is complete and locked." : "Signature saved. The other signature is still needed.");
    router.refresh();
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <Card title="Client">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-caption text-muted-foreground">Client name</dt>
            <dd className="font-semibold">{patient.name}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Date of birth</dt>
            <dd>{DAY(patient.dob)}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Date of referral</dt>
            <dd>{DAY(patient.referralDate)}</dd>
          </div>
        </dl>
        {addressFields("client")}
        {field("client", "initialContactDate", "Date of initial client contact", { type: "date", className: "sm:max-w-60" })}
      </Card>

      <Card title="Emergency contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("emergency", "name", "Name")}
          {field("emergency", "relationship", "Relationship (optional)")}
        </div>
        {addressFields("emergency")}
      </Card>

      <Card title="Insurance details" help="The insurance company, or whoever is responsible for paying.">
        {field("insurance", "responsibleParty", "Responsible party")}
        {addressFields("insurance")}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {field("insurance", "coveragePercent", "Insurance covers (%)", { inputMode: "decimal" })}
          {field("insurance", "clientPerVisit", "Client pays per visit", { placeholder: "e.g. $0.00" })}
          {field("insurance", "deductible", "Deductible billed to client", { placeholder: "e.g. $0.00" })}
        </div>
      </Card>

      <Card title="Services" help="Tick each service to be provided and fill in its row.">
        <div className="grid gap-2">
          <Label htmlFor="serviceNeeds">I believe my service needs to be</Label>
          <Textarea id="serviceNeeds" rows={2} maxLength={1000} value={d.serviceNeeds} onChange={(e) => set("serviceNeeds", e.target.value)} placeholder="e.g. Skilled nursing; personal care assistance" />
        </div>
        {d.services.map((s, i) => {
          const edit = (patch: Partial<typeof s>) => set("services", d.services.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <fieldset key={s.key} className="grid gap-3 rounded-md border border-border-subtle p-4">
              <legend className="sr-only">{s.label}</legend>
              <label className="flex items-center gap-3 font-semibold">
                <Checkbox checked={s.included} onCheckedChange={(on) => edit({ included: Boolean(on) })} />
                {s.label}
              </label>
              {s.included && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FormField label="Frequency" name={`${s.key}-frequency`} value={s.frequency} onChange={(e) => edit({ frequency: e.target.value })} placeholder="e.g. 4 hours daily" />
                  <FormField label="Duration" name={`${s.key}-duration`} value={s.duration} onChange={(e) => edit({ duration: e.target.value })} placeholder="e.g. To be determined" />
                  <FormField label="Charge" name={`${s.key}-charge`} value={s.charge} onChange={(e) => edit({ charge: e.target.value })} placeholder="e.g. $26.81" />
                  <FormField label="Payer" name={`${s.key}-payer`} value={s.payer} onChange={(e) => edit({ payer: e.target.value })} />
                  <FormField label="Payer pays" name={`${s.key}-payerAmount`} value={s.payerAmount} onChange={(e) => edit({ payerAmount: e.target.value })} />
                  <FormField label="Client pays" name={`${s.key}-clientAmount`} value={s.clientAmount} onChange={(e) => edit({ clientAmount: e.target.value })} />
                </div>
              )}
            </fieldset>
          );
        })}
      </Card>

      <Card title="Rates, holidays and deposit">
        <label className="flex items-center gap-3">
          <Checkbox checked={d.rates.notApplicable} onCheckedChange={(on) => set("rates", { ...d.rates, notApplicable: Boolean(on) })} />
          Bill rate not applicable
        </label>
        {!d.rates.notApplicable &&
          (["weekend", "weekday"] as const).map((k) => (
            <div key={k} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label={k === "weekend" ? "Weekend rate" : "Weekday rate"} name={`${k}-amount`} value={d.rates[k].amount} onChange={(e) => set("rates", { ...d.rates, [k]: { ...d.rates[k], amount: e.target.value } })} placeholder="e.g. $25.00" />
              <FormField label="For hours" name={`${k}-hours`} value={d.rates[k].hours} onChange={(e) => set("rates", { ...d.rates, [k]: { ...d.rates[k], hours: e.target.value } })} />
              <FormField label="Or visits" name={`${k}-visits`} value={d.rates[k].visits} onChange={(e) => set("rates", { ...d.rates, [k]: { ...d.rates[k], visits: e.target.value } })} />
            </div>
          ))}
        <FormField label="Other local holidays (optional)" name="holidays" value={d.holidays} onChange={(e) => set("holidays", e.target.value)} />
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Deposit</legend>
          <div role="radiogroup" aria-label="Deposit" className="flex flex-wrap gap-2">
            {(["none", "cash", "check", "card"] as const).map((m) => (
              <ChoiceChip key={m} single size="sm" on={d.deposit.method === m} onClick={() => set("deposit", { ...d.deposit, method: m })}>
                {m === "none" ? "No deposit" : m === "card" ? "Card" : m[0].toUpperCase() + m.slice(1)}
              </ChoiceChip>
            ))}
          </div>
          {d.deposit.method !== "none" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Amount" name="deposit-amount" value={d.deposit.amount} onChange={(e) => set("deposit", { ...d.deposit, amount: e.target.value })} />
              {d.deposit.method === "check" && (
                <FormField label="Check number" name="deposit-check" value={d.deposit.checkNumber} onChange={(e) => set("deposit", { ...d.deposit, checkNumber: e.target.value })} />
              )}
            </div>
          )}
          <p className="text-caption text-muted-foreground">Card numbers are never stored in Tiba.</p>
        </fieldset>
      </Card>

      <Card title="The agreement" help={`What ${first} agrees to. Your practice's wording; edit it in Settings.`}>
        {blanks.length > 0 && (
          <p className="flex gap-2 rounded-md bg-warning px-4 py-3 text-small text-warning-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              The wording still has blanks to fill in before anyone can sign: {blanks.join(", ")}.{" "}
              <Link href="/admin/settings/agreement" className="font-semibold underline">
                Edit the wording
              </Link>
            </span>
          </p>
        )}
        <div className="grid max-h-[28rem] gap-4 overflow-y-auto rounded-md border border-border-subtle p-4">
          {sections.map((s) => (
            <div key={s.id} className="grid gap-1">
              <h3 className="font-sans text-body font-semibold text-primary">{s.h}</h3>
              <p className="text-small break-words whitespace-pre-line">{s.text}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`${first}'s answers`}>
        {(
          [
            ["personalFunds", `Access to ${first}'s personal funds`],
            ["vehicle", `Use of ${first}'s personal vehicle`],
          ] as const
        ).map(([k, label]) => (
          <fieldset key={k} className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{label}</legend>
            <div role="radiogroup" aria-label={label} className="flex gap-2">
              {[true, false].map((yes) => (
                <ChoiceChip key={String(yes)} single size="sm" on={d.authorizations[k] === yes} onClick={() => set("authorizations", { ...d.authorizations, [k]: yes })}>
                  {yes ? "Yes" : "No"}
                </ChoiceChip>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Who signs for the client</legend>
          <div role="radiogroup" aria-label="Who signs" className="flex flex-wrap gap-2">
            {(
              [
                ["client", first],
                ["responsible", "A responsible party"],
                ["refused", "Refused to sign"],
              ] as const
            ).map(([k, label]) => (
              <ChoiceChip key={k} single size="sm" on={d.signer.kind === k} onClick={() => set("signer", { ...d.signer, kind: k })}>
                {label}
              </ChoiceChip>
            ))}
          </div>
          {d.signer.kind === "responsible" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Responsible party's name" name="signer-name" value={d.signer.name} onChange={(e) => set("signer", { ...d.signer, name: e.target.value })} />
              <FormField label="Relationship to the client" name="signer-relationship" value={d.signer.relationship} onChange={(e) => set("signer", { ...d.signer, relationship: e.target.value })} />
            </div>
          )}
        </fieldset>
        {!refused && (
          <>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">By signing, the client is</legend>
              <div role="radiogroup" aria-label="Decision" className="flex gap-2">
                <ChoiceChip single size="sm" on={d.decision === "accept"} onClick={() => set("decision", "accept")}>
                  Accepting the services
                </ChoiceChip>
                <ChoiceChip single size="sm" on={d.decision === "deny"} onClick={() => set("decision", "deny")}>
                  Denying the services
                </ChoiceChip>
              </div>
            </fieldset>
            <FormField
              label="Initials"
              name="initials"
              value={d.initials}
              maxLength={10}
              onChange={(e) => set("initials", e.target.value)}
              hint="The client's or responsible party's initials, confirming the billing, authorizations and rights sections."
              className="sm:max-w-40"
            />
          </>
        )}
      </Card>

      <Card title="Signatures" help="Signatures can't be changed once saved. When both are in, the agreement is locked and can be downloaded.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {refused ? (
            <p className="rounded-md bg-muted p-4 text-small">
              {first} refused to sign. The agency witness signs to record it.
            </p>
          ) : (
            <div className="grid gap-2">
              <SignaturePad label={d.signer.kind === "responsible" ? "Responsible party" : "Client"} name={d.signer.kind === "responsible" ? d.signer.name || "Responsible party" : patient.name} onChange={setClientSig} />
              <p className="text-caption text-muted-foreground">Hand the device over to sign.</p>
            </div>
          )}
          <div className="grid gap-2">
            <FormField label="Agency witness" name="witnessName" value={d.witnessName} onChange={(e) => set("witnessName", e.target.value)} />
            <SignaturePad label="Agency witness" name={d.witnessName || "Agency witness"} onChange={setWitnessSig} />
          </div>
        </div>
      </Card>

      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={sign} disabled={busy !== null}>
          {busy === "sign" ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
          Save signatures
        </Button>
        <Button variant="outline" onClick={save} disabled={busy !== null}>
          {busy === "save" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Save details
        </Button>
      </div>
    </div>
  );
}
