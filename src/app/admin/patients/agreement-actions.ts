"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { serviceAgreements } from "@/db/schema";
import { blanksIn, renderClauses, SERVICE_KEYS, type AgreementDetails } from "@/lib/agreement-template";
import { loadAgreement, practiceAgreementClauses } from "@/lib/agreements";
import { requireAdmin } from "@/lib/auth";
import { isSignatureImage } from "@/lib/signature";

const t = (max = 120) => z.string().trim().max(max);
const address = { address: t(200), city: t(), state: t(), zip: t(20), phone: t(40) };
const row = z.object({
  key: z.enum(SERVICE_KEYS),
  label: t(),
  included: z.boolean(),
  frequency: t(),
  duration: t(),
  charge: t(40),
  payer: t(),
  payerAmount: t(40),
  clientAmount: t(40),
});
const amounts = z.object({ amount: t(40), hours: t(20), visits: t(20) });

const detailsSchema = z.object({
  client: z.object({ ...address, initialContactDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/) }),
  emergency: z.object({ ...address, name: t(), relationship: t(60) }),
  insurance: z.object({ ...address, responsibleParty: t(), coveragePercent: t(10), clientPerVisit: t(40), deductible: t(40) }),
  serviceNeeds: t(1000),
  services: z.array(row).length(SERVICE_KEYS.length),
  rates: z.object({ notApplicable: z.boolean(), weekend: amounts, weekday: amounts }),
  holidays: t(300),
  deposit: z.object({ amount: t(40), method: z.enum(["none", "check", "cash", "card"]), checkNumber: t(40) }),
  authorizations: z.object({ personalFunds: z.boolean().nullable(), vehicle: z.boolean().nullable() }),
  decision: z.enum(["accept", "deny"]).nullable(),
  initials: t(10),
  signer: z.object({ kind: z.enum(["client", "responsible", "refused"]), name: t(), relationship: t(60) }),
  witnessName: t(),
});

type Result = { ok: true; complete: boolean } | { ok: false; message: string };

/** What must be filled in before anyone signs. Null when ready. */
function missingForSigning(d: AgreementDetails, refusing: boolean) {
  if (!d.client.address || !d.client.phone) return "Add the client's address and telephone.";
  if (!d.insurance.responsibleParty) return "Add the insurance company or responsible party.";
  if (!d.services.some((s) => s.included)) return "Tick at least one service to be provided.";
  if (!d.witnessName) return "Add the agency witness's name.";
  if (refusing) return null;
  if (d.signer.kind === "responsible" && (!d.signer.name || !d.signer.relationship)) {
    return "Add the responsible party's name and relationship to the client.";
  }
  if (!d.decision) return "Choose whether the client accepts or denies the services.";
  if (d.authorizations.personalFunds === null || d.authorizations.vehicle === null) {
    return "Answer Yes or No for personal funds and for the personal vehicle.";
  }
  if (!d.initials) return "Add the client's (or responsible party's) initials.";
  return null;
}

/** Save the agreement's details without signing (only before anyone has signed). */
export async function saveAgreementDetails(input: { patientId: string; details: AgreementDetails }): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = detailsSchema.safeParse(input.details);
  if (!parsed.success) return { ok: false, message: "Please check the details. Some answers are too long or missing." };
  const found = await loadAgreement(String(input.patientId ?? ""), admin.practiceId, admin.name);
  if (!found) return { ok: false, message: "We couldn't find that patient. Please go back to Patients." };
  if (found.started) return { ok: false, message: "This agreement has been signed, so its details can't change." };
  const details = parsed.data as AgreementDetails;
  const sections = renderClauses(await practiceAgreementClauses(admin.practiceId), {
    practice: found.patient.practiceName,
    client: found.patient.fullName,
    details,
  });
  const values = { sections, details, parties: found.parties, updatedAt: new Date() };
  if (found.agreement) {
    await db.update(serviceAgreements).set(values).where(eq(serviceAgreements.id, found.agreement.id));
  } else {
    await db.insert(serviceAgreements).values({ practiceId: admin.practiceId, patientId: found.patient.id, ...values });
  }
  revalidatePath(`/admin/patients/${found.patient.id}`);
  return { ok: true, complete: false };
}

/**
 * Save signatures: the client (or their responsible party) and the agency witness sign on the
 * device, together or one at a time. If the client refuses, the witness signs to record it. The
 * first signature fixes the wording and details; a complete agreement is locked (drizzle/0026).
 */
export async function saveAgreementSignatures(input: {
  patientId: string;
  details: AgreementDetails | null;
  clientSignature: string | null;
  witnessSignature: string | null;
}): Promise<Result> {
  const admin = await requireAdmin();
  const found = await loadAgreement(String(input.patientId ?? ""), admin.practiceId, admin.name);
  if (!found) return { ok: false, message: "We couldn't find that patient. Please go back to Patients." };
  const current = found.agreement;

  let details = found.details;
  if (!found.started) {
    const parsed = detailsSchema.safeParse(input.details);
    if (!parsed.success) return { ok: false, message: "Please check the details. Some answers are too long or missing." };
    details = parsed.data as AgreementDetails;
  }
  const refusing = details.signer.kind === "refused";
  const clientSig = !refusing && input.clientSignature && !current?.patientSignature ? input.clientSignature : null;
  const witnessSig = input.witnessSignature && !current?.adminSignature ? input.witnessSignature : null;
  if (refusing && !witnessSig && !current?.adminSignature) return { ok: false, message: "The agency witness signs to record that the client refused." };
  if (!clientSig && !witnessSig) return { ok: false, message: "Add a signature first: the client's, the witness's, or both." };
  if ((clientSig && !isSignatureImage(clientSig)) || (witnessSig && !isSignatureImage(witnessSig))) {
    return { ok: false, message: "A signature didn't come through. Clear it and sign again." };
  }
  if (!found.started) {
    const missing = missingForSigning(details, refusing);
    if (missing) return { ok: false, message: missing };
    const blanks = blanksIn(await practiceAgreementClauses(admin.practiceId));
    if (blanks.length) {
      return { ok: false, message: `The agreement wording still has blanks: ${blanks.join(", ")}. Fill them in under Settings → Service agreement before anyone signs.` };
    }
  }

  const now = new Date();
  const signatures = {
    ...(clientSig && { patientSignature: clientSig, patientSignedAt: now }),
    ...(witnessSig && { adminSignature: witnessSig, adminSignedName: details.witnessName || admin.name, adminSignedAt: now }),
  };
  if (found.started && current) {
    await db.update(serviceAgreements).set({ ...signatures, updatedAt: now }).where(eq(serviceAgreements.id, current.id));
  } else {
    // First signature: fix the wording as it reads now, with these details.
    const sections = renderClauses(await practiceAgreementClauses(admin.practiceId), {
      practice: found.patient.practiceName,
      client: found.patient.fullName,
      details,
    });
    const values = { sections, details, refused: refusing, parties: found.parties, ...signatures, updatedAt: now };
    if (current) await db.update(serviceAgreements).set(values).where(eq(serviceAgreements.id, current.id));
    else await db.insert(serviceAgreements).values({ practiceId: admin.practiceId, patientId: found.patient.id, ...values });
  }

  revalidatePath(`/admin/patients/${found.patient.id}`);
  revalidatePath("/admin/patients");
  const hasWitness = Boolean(current?.adminSignature || witnessSig);
  const hasClient = Boolean(current?.patientSignature || clientSig);
  return { ok: true, complete: hasWitness && (hasClient || refusing) };
}
