import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, diagnosisCodes, patientDiagnoses, patientOffers, patients } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { renderEmail, sendEmail } from "@/lib/email";
import { clearNotifications, notifyAccount, notifyAdmins } from "@/lib/notifications";
import { OFFER_FOR, servicesForDiscipline, type Service } from "@/lib/patient-options";

// Offering a new patient (decided 31 Oct 2026): the admin offers a patient to every active
// clinician whose discipline does the type of care (OFFER_FOR), and the first to accept becomes
// their clinician. Emails never carry the patient's name; the details are only in Tiba.

export const OFFERS_PATH = "/new-patients";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Active clinicians in the practice who can accept this type of care. */
export function eligibleClinicians(practiceId: string, service: Service, from: Db | Tx = db) {
  return from
    .select({ id: clinicians.id, name: clinicians.name, email: clinicians.email })
    .from(clinicians)
    .where(
      and(
        eq(clinicians.practiceId, practiceId),
        eq(clinicians.role, "clinician"),
        eq(clinicians.status, "active"),
        inArray(clinicians.discipline, OFFER_FOR[service].disciplines),
      ),
    );
}

/** Tells each clinician who can accept: a notification and an email, without the patient's name. */
export async function announceOffer(practiceId: string, offerId: string, service: Service) {
  const words = OFFER_FOR[service];
  const team = await eligibleClinicians(practiceId, service);
  const base = appUrl();
  for (const c of team) {
    await notifyAccount(practiceId, c.id, {
      type: "patient_offer",
      refId: offerId,
      title: `New patient who needs ${words.care}`,
      detail: "The first clinician to accept will see them.",
      href: OFFERS_PATH,
    });
    try {
      const email = renderEmail({
        heading: `A new patient needs ${words.care}`,
        intro: `Your practice has a new patient who needs ${words.care}. The first clinician to accept will see them. For the patient's privacy, their details are only in Tiba.`,
        action: base ? { label: "See the patient in Tiba", url: `${base}${OFFERS_PATH}` } : undefined,
      });
      await sendEmail({ to: c.email, subject: `New patient: ${words.care}`, ...email });
    } catch {
      // The notification is already in Tiba; one failed email mustn't stop the others.
    }
  }
}

/** Open offers this clinician can accept, with what they need to decide. */
export async function openOffersFor(practiceId: string, discipline: string | null) {
  const services = servicesForDiscipline(discipline);
  if (!services.length) return [];
  const rows = await db
    .select({
      id: patientOffers.id,
      service: patientOffers.service,
      offeredAt: patientOffers.offeredAt,
      patientId: patients.id,
      fullName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      address: patients.address,
      insurer: patients.insurer,
      servicesOrdered: patients.servicesOrdered,
      orderingDoctor: patients.orderingDoctor,
      referralDate: patients.referralDate,
      startOfCare: patients.startOfCare,
    })
    .from(patientOffers)
    .innerJoin(patients, eq(patients.id, patientOffers.patientId))
    .where(
      and(
        eq(patientOffers.practiceId, practiceId),
        eq(patientOffers.status, "open"),
        inArray(patientOffers.service, services),
        eq(patients.status, "active"),
        isNull(patients.clinicianId),
      ),
    )
    .orderBy(asc(patientOffers.offeredAt));
  if (!rows.length) return [];
  const diagnoses = await db
    .select({ patientId: patientDiagnoses.patientId, code: diagnosisCodes.code, description: diagnosisCodes.description })
    .from(patientDiagnoses)
    .innerJoin(diagnosisCodes, eq(diagnosisCodes.code, patientDiagnoses.code))
    .where(inArray(patientDiagnoses.patientId, rows.map((r) => r.patientId)))
    .orderBy(asc(patientDiagnoses.addedAt));
  return rows.map((r) => ({ ...r, diagnoses: diagnoses.filter((d) => d.patientId === r.patientId) }));
}

/** How many open offers this clinician could accept (the menu count). */
export async function openOfferCount(practiceId: string, discipline: string | null) {
  const services = servicesForDiscipline(discipline);
  if (!services.length) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(patientOffers)
    .innerJoin(patients, eq(patients.id, patientOffers.patientId))
    .where(
      and(
        eq(patientOffers.practiceId, practiceId),
        eq(patientOffers.status, "open"),
        inArray(patientOffers.service, services),
        eq(patients.status, "active"),
        isNull(patients.clinicianId),
      ),
    );
  return row?.n ?? 0;
}

type Taker = { id: string; name: string; practiceId: string };

/**
 * Accepts an offer: first come, first served. The offer only moves from open to taken once, and
 * the patient only gets a clinician while they have none, so two clinicians accepting at the same
 * moment can't both get the patient.
 */
export async function acceptOffer(
  clinician: Taker,
  offerId: string,
): Promise<{ ok: true; patientId: string; name: string } | { ok: false; message: string }> {
  const [me] = await db.select({ discipline: clinicians.discipline }).from(clinicians).where(eq(clinicians.id, clinician.id));
  const [offer] = await db
    .select({ service: patientOffers.service, status: patientOffers.status })
    .from(patientOffers)
    .where(and(eq(patientOffers.id, offerId), eq(patientOffers.practiceId, clinician.practiceId)));
  if (!offer) return { ok: false, message: "We couldn't find that patient. Please refresh the page." };
  if (offer.status !== "open") return { ok: false, message: "Another clinician accepted this patient first." };
  if (!servicesForDiscipline(me?.discipline ?? null).includes(offer.service as Service)) {
    return { ok: false, message: "This patient needs a different discipline. Check your role in Settings." };
  }

  const taken = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(patientOffers)
      .set({ status: "taken", takenById: clinician.id, closedAt: new Date() })
      .where(and(eq(patientOffers.id, offerId), eq(patientOffers.status, "open")))
      .returning({ patientId: patientOffers.patientId });
    if (!row) return null;
    const [patient] = await tx
      .update(patients)
      .set({ clinicianId: clinician.id, updatedAt: new Date() })
      .where(and(eq(patients.id, row.patientId), isNull(patients.clinicianId), eq(patients.status, "active")))
      .returning({ id: patients.id, name: patients.fullName });
    if (!patient) tx.rollback();
    return patient;
  }).catch(() => null);
  if (!taken) return { ok: false, message: "Another clinician accepted this patient first." };

  // Everyone else's notification about this patient is done with.
  await clearNotifications(clinician.practiceId, "patient_offer", offerId).catch(() => undefined);
  await reportTaken(clinician, taken, offer.service as Service);
  return { ok: true, patientId: taken.id, name: taken.name };
}

async function reportTaken(clinician: Taker, patient: { id: string; name: string }, service: Service) {
  await notifyAdmins(clinician.practiceId, {
    type: "offer_taken",
    refId: patient.id,
    title: `${clinician.name} accepted ${patient.name}`,
    detail: `New patient for ${OFFER_FOR[service].care}`,
    href: `/admin/patients/${patient.id}`,
  });
  try {
    const admins = await db
      .select({ email: clinicians.email })
      .from(clinicians)
      .where(and(eq(clinicians.practiceId, clinician.practiceId), eq(clinicians.role, "admin"), eq(clinicians.status, "active")));
    const base = appUrl();
    const heading = `${clinician.name} accepted your new patient`;
    for (const admin of admins) {
      const email = renderEmail({
        heading,
        intro: `${clinician.name} was the first to accept the new patient you offered for ${OFFER_FOR[service].care}, so they are now the patient's clinician. For the patient's privacy, their details are only in Tiba.`,
        action: base ? { label: "See the patient in Tiba", url: `${base}/admin/patients/${patient.id}` } : undefined,
      });
      await sendEmail({ to: admin.email, subject: heading, ...email }).catch(() => undefined);
    }
  } catch {
    // The notification is already in Tiba.
  }
}

/** Ends a patient's open offer once the admin assigns a clinician or discharges them. */
export async function closeOffer(patientId: string, from: Db | Tx = db) {
  const closed = await from
    .update(patientOffers)
    .set({ status: "closed", closedAt: new Date() })
    .where(and(eq(patientOffers.patientId, patientId), eq(patientOffers.status, "open")))
    .returning({ id: patientOffers.id, practiceId: patientOffers.practiceId });
  for (const o of closed) await clearNotifications(o.practiceId, "patient_offer", o.id).catch(() => undefined);
}

/** A patient's latest offer, for the admin's patient page. */
export async function latestOffer(patientId: string) {
  const [row] = await db
    .select({
      id: patientOffers.id,
      service: patientOffers.service,
      status: patientOffers.status,
      offeredTo: patientOffers.offeredTo,
      offeredAt: patientOffers.offeredAt,
      closedAt: patientOffers.closedAt,
      takenBy: clinicians.name,
    })
    .from(patientOffers)
    .leftJoin(clinicians, eq(clinicians.id, patientOffers.takenById))
    .where(eq(patientOffers.patientId, patientId))
    .orderBy(desc(patientOffers.offeredAt))
    .limit(1);
  return row ?? null;
}

/** Patients offered and not accepted yet (admin Overview). */
export function waitingOffers(practiceId: string) {
  return db
    .select({ patientId: patients.id, name: patients.fullName, service: patientOffers.service, offeredAt: patientOffers.offeredAt })
    .from(patientOffers)
    .innerJoin(patients, eq(patients.id, patientOffers.patientId))
    .where(and(eq(patientOffers.practiceId, practiceId), eq(patientOffers.status, "open"), eq(patients.status, "active")))
    .orderBy(asc(patientOffers.offeredAt));
}
