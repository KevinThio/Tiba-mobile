import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, diagnosisCodes, patientDiagnoses, patientOfferResponses, patientOffers, patients } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { renderEmail, sendEmail } from "@/lib/email";
import { clearNotifications, notifyAccount, notifyAdmins } from "@/lib/notifications";
import { OFFER_FOR, servicesForDiscipline, type Service } from "@/lib/patient-options";

// Offering a patient (decided 31 Oct 2026): the admin offers a patient to every active clinician
// whose discipline does the type of care (OFFER_FOR). Each is emailed a link to accept or decline;
// the admin sees every answer (and is emailed it) and assigns one of the clinicians who accepted,
// usually the first. Emails never carry the patient's name.

export const OFFERS_PATH = "/new-patients";

/**
 * The clinician's link to one offered patient: New patients shows that card first. A query, not a
 * #fragment, so it survives the sign-in redirect. The id isn't patient data.
 */
export const offerLink = (offerId: string) => `${OFFERS_PATH}?offer=${offerId}`;

export type OfferAnswer = "accepted" | "declined";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Account = { id: string; name: string; practiceId: string };

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

/** How many active clinicians can accept each type of care (the offer pickers). */
export async function offerCounts(practiceId: string) {
  const team = await db
    .select({ discipline: clinicians.discipline })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "clinician"), eq(clinicians.status, "active")));
  return Object.fromEntries(
    (Object.keys(OFFER_FOR) as Service[]).map((s) => [s, team.filter((c) => c.discipline && OFFER_FOR[s].disciplines.includes(c.discipline)).length]),
  ) as Record<Service, number>;
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
      detail: "Accept or decline. Your admin assigns one of the clinicians who accept.",
      href: offerLink(offerId),
    });
    try {
      const email = renderEmail({
        heading: `A new patient needs ${words.care}`,
        intro: `Your practice has a new patient who needs ${words.care}. Please open Tiba to see their details, then accept if you can take them or decline if you can't. Your admin will assign one of the clinicians who accept. For the patient's privacy, their details are only in Tiba.`,
        action: base ? { label: "Accept or decline", url: `${base}${offerLink(offerId)}` } : undefined,
      });
      await sendEmail({ to: c.email, subject: `New patient: ${words.care}`, ...email });
    } catch {
      // The notification is already in Tiba; one failed email mustn't stop the others.
    }
  }
}

/** Open offers this clinician can accept, with what they need to decide and whether they have. */
export async function openOffersFor(practiceId: string, clinicianId: string, discipline: string | null) {
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
      answer: patientOfferResponses.answer,
      reason: patientOfferResponses.reason,
      answeredAt: patientOfferResponses.answeredAt,
    })
    .from(patientOffers)
    .innerJoin(patients, eq(patients.id, patientOffers.patientId))
    .leftJoin(
      patientOfferResponses,
      and(eq(patientOfferResponses.offerId, patientOffers.id), eq(patientOfferResponses.clinicianId, clinicianId)),
    )
    .where(
      and(
        eq(patientOffers.practiceId, practiceId),
        eq(patientOffers.status, "open"),
        inArray(patientOffers.service, services),
        eq(patients.status, "active"),
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

/** Open offers this clinician hasn't answered yet (the menu count). */
export async function openOfferCount(practiceId: string, clinicianId: string, discipline: string | null) {
  const services = servicesForDiscipline(discipline);
  if (!services.length) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(patientOffers)
    .innerJoin(patients, eq(patients.id, patientOffers.patientId))
    .leftJoin(
      patientOfferResponses,
      and(eq(patientOfferResponses.offerId, patientOffers.id), eq(patientOfferResponses.clinicianId, clinicianId)),
    )
    .where(
      and(
        eq(patientOffers.practiceId, practiceId),
        eq(patientOffers.status, "open"),
        inArray(patientOffers.service, services),
        eq(patients.status, "active"),
        isNull(patientOfferResponses.id),
      ),
    );
  return row?.n ?? 0;
}

/**
 * A clinician answers an offered patient: accept (they can take them) or decline, with an optional
 * reason. They can change their answer while the offer is open. The admins are told each answer
 * in Tiba and by email; the admin assigns one of the clinicians who accepted.
 */
export async function answerOffer(
  clinician: Account,
  offerId: string,
  answer: OfferAnswer,
  reason: string | null,
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const [me] = await db.select({ discipline: clinicians.discipline }).from(clinicians).where(eq(clinicians.id, clinician.id));
  const [offer] = await db
    .select({ service: patientOffers.service, status: patientOffers.status, patientId: patients.id, name: patients.fullName, patientStatus: patients.status })
    .from(patientOffers)
    .innerJoin(patients, eq(patients.id, patientOffers.patientId))
    .where(and(eq(patientOffers.id, offerId), eq(patientOffers.practiceId, clinician.practiceId)));
  if (!offer) return { ok: false, message: "We couldn't find that patient. Please refresh the page." };
  if (offer.status !== "open" || offer.patientStatus !== "active") return { ok: false, message: "Your admin has already assigned this patient." };
  if (!servicesForDiscipline(me?.discipline ?? null).includes(offer.service as Service)) {
    return { ok: false, message: "This patient needs a different discipline. Check your role in Settings." };
  }
  const [before] = await db
    .select({ answer: patientOfferResponses.answer })
    .from(patientOfferResponses)
    .where(and(eq(patientOfferResponses.offerId, offerId), eq(patientOfferResponses.clinicianId, clinician.id)));
  const why = answer === "declined" ? reason : null;
  await db
    .insert(patientOfferResponses)
    .values({ offerId, clinicianId: clinician.id, answer, reason: why })
    .onConflictDoUpdate({
      target: [patientOfferResponses.offerId, patientOfferResponses.clinicianId],
      set: { answer, reason: why, answeredAt: new Date() },
    });
  if (before?.answer !== answer) await reportAnswer(clinician, offerId, offer.patientId, offer.name, offer.service as Service, answer, why);
  return { ok: true, name: offer.name };
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

/** Tells the admins about an answer: a notification and an email, without the patient's name. */
async function reportAnswer(
  clinician: Account,
  offerId: string,
  patientId: string,
  patientName: string,
  service: Service,
  answer: OfferAnswer,
  reason: string | null,
) {
  const answers = await offerResponses(offerId);
  const accepted = answers.filter((r) => r.answer === "accepted");
  const place = accepted.findIndex((r) => r.clinicianId === clinician.id) + 1;
  const words = OFFER_FOR[service];
  const href = `/admin/patients/${patientId}#offer`;
  const accepting = answer === "accepted";
  await notifyAdmins(clinician.practiceId, {
    type: accepting ? "offer_accepted" : "offer_declined",
    refId: offerId,
    title: `${clinician.name} ${answer} ${patientName}`,
    detail: accepting
      ? `${place === 1 ? "First" : ordinal(place)} to accept · assign a clinician on the patient's page`
      : reason
        ? `Reason: ${reason}`
        : "No reason given",
    href,
  });
  try {
    const admins = await db
      .select({ email: clinicians.email })
      .from(clinicians)
      .where(and(eq(clinicians.practiceId, clinician.practiceId), eq(clinicians.role, "admin"), eq(clinicians.status, "active")));
    const base = appUrl();
    const heading = `${clinician.name} ${answer} your new patient`;
    const summary = `So far ${accepted.length} accepted and ${answers.length - accepted.length} declined.`;
    for (const admin of admins) {
      const email = renderEmail({
        heading,
        intro: accepting
          ? `${clinician.name} can take the patient you offered for ${words.care} (${place === 1 ? "the first" : `the ${ordinal(place)}`} to accept). ${summary} Assign a clinician in Tiba; the first to accept is suggested. For the patient's privacy, their details are only in Tiba.`
          : `${clinician.name} can't take the patient you offered for ${words.care}. ${summary} Their reason, if they gave one, is in Tiba. For the patient's privacy, their details are only in Tiba.`,
        action: base ? { label: accepting ? "Assign a clinician" : "See the answers", url: `${base}${href}` } : undefined,
      });
      await sendEmail({ to: admin.email, subject: heading, ...email }).catch(() => undefined);
    }
  } catch {
    // The notification is already in Tiba.
  }
}

/** The clinicians who accepted an offer, first first. */
export function offerResponses(offerId: string) {
  return db
    .select({
      clinicianId: clinicians.id,
      name: clinicians.name,
      status: clinicians.status,
      answer: patientOfferResponses.answer,
      reason: patientOfferResponses.reason,
      answeredAt: patientOfferResponses.answeredAt,
    })
    .from(patientOfferResponses)
    .innerJoin(clinicians, eq(clinicians.id, patientOfferResponses.clinicianId))
    .where(eq(patientOfferResponses.offerId, offerId))
    .orderBy(asc(patientOfferResponses.answeredAt));
}

/**
 * The admin assigns the patient to one of the clinicians who accepted. The chosen clinician is
 * told (by email too, without the patient's name); the others see it went to someone else.
 */
export async function assignFromOffer(
  admin: Account,
  offerId: string,
  clinicianId: string,
): Promise<{ ok: true; clinician: string } | { ok: false; message: string }> {
  const responses = await offerResponses(offerId);
  const chosen = responses.find((r) => r.clinicianId === clinicianId && r.answer === "accepted");
  if (!chosen) return { ok: false, message: "Pick one of the clinicians who accepted." };
  if (chosen.status !== "active") return { ok: false, message: `${chosen.name}'s account isn't active any more. Pick someone else.` };

  const patient = await db
    .transaction(async (tx) => {
      const [offer] = await tx
        .update(patientOffers)
        .set({ status: "taken", takenById: clinicianId, closedAt: new Date() })
        .where(and(eq(patientOffers.id, offerId), eq(patientOffers.practiceId, admin.practiceId), eq(patientOffers.status, "open")))
        .returning({ patientId: patientOffers.patientId });
      if (!offer) return null;
      const [row] = await tx
        .update(patients)
        .set({ clinicianId, updatedAt: new Date() })
        .where(and(eq(patients.id, offer.patientId), eq(patients.status, "active")))
        .returning({ id: patients.id, name: patients.fullName });
      if (!row) tx.rollback();
      return row;
    })
    .catch(() => null);
  if (!patient) return { ok: false, message: "This offer has already ended. Please refresh the page." };

  await clearNotifications(admin.practiceId, "patient_offer", offerId).catch(() => undefined);
  await clearNotifications(admin.practiceId, "offer_accepted", offerId).catch(() => undefined);
  await clearNotifications(admin.practiceId, "offer_declined", offerId).catch(() => undefined);
  await notifyAccount(admin.practiceId, clinicianId, {
    type: "offer_assigned",
    refId: offerId,
    title: `${patient.name} is your patient now`,
    detail: "Your admin assigned them to you after you accepted.",
    href: `/patients/${patient.id}`,
  });
  for (const other of responses.filter((r) => r.clinicianId !== clinicianId && r.answer === "accepted")) {
    await notifyAccount(admin.practiceId, other.clinicianId, {
      type: "offer_assigned_other",
      refId: offerId,
      title: `${patient.name} was assigned to another clinician`,
      detail: "Thanks for accepting. Your admin picked someone else this time.",
      href: OFFERS_PATH,
    });
  }
  try {
    const [to] = await db.select({ email: clinicians.email }).from(clinicians).where(eq(clinicians.id, clinicianId));
    const base = appUrl();
    const email = renderEmail({
      heading: "You have a new patient",
      intro: "Your practice assigned you the new patient you accepted. For the patient's privacy, their details are only in Tiba.",
      action: base ? { label: "See the patient in Tiba", url: `${base}/patients/${patient.id}` } : undefined,
    });
    if (to) await sendEmail({ to: to.email, subject: "You have a new patient", ...email });
  } catch {
    // The notification is already in Tiba.
  }
  return { ok: true, clinician: chosen.name };
}

/** Offers a patient already in the practice (from their page). */
export async function offerPatient(
  admin: Account,
  patientId: string,
  service: Service,
): Promise<{ ok: true; offeredTo: number } | { ok: false; message: string }> {
  const team = await eligibleClinicians(admin.practiceId, service);
  if (!team.length) {
    return { ok: false, message: `None of your active clinicians are ${OFFER_FOR[service].who} yet. Ask your team to set their role in Settings.` };
  }
  const [patient] = await db
    .select({ services: patients.servicesOrdered })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.practiceId, admin.practiceId), eq(patients.status, "active")));
  if (!patient) return { ok: false, message: "Only active patients can be offered. Reactivate them first." };

  const offerId = await db
    .transaction(async (tx) => {
      // The type of care offered is always one of the services ordered.
      if (!patient.services.includes(service)) {
        await tx.update(patients).set({ servicesOrdered: [...patient.services, service], updatedAt: new Date() }).where(eq(patients.id, patientId));
      }
      const [offer] = await tx
        .insert(patientOffers)
        .values({ practiceId: admin.practiceId, patientId, service, offeredById: admin.id, offeredTo: team.length })
        .returning({ id: patientOffers.id });
      return offer.id;
    })
    .catch(() => null);
  // The only expected failure is the one-open-offer-per-patient index.
  if (!offerId) return { ok: false, message: "This patient is already offered to your clinicians. Please refresh the page." };
  await announceOffer(admin.practiceId, offerId, service);
  return { ok: true, offeredTo: team.length };
}

/** Ends a patient's open offer: withdrawn, a clinician picked in Care, or the patient discharged. */
export async function closeOffer(patientId: string, from: Db | Tx = db) {
  const closed = await from
    .update(patientOffers)
    .set({ status: "closed", closedAt: new Date() })
    .where(and(eq(patientOffers.patientId, patientId), eq(patientOffers.status, "open")))
    .returning({ id: patientOffers.id, practiceId: patientOffers.practiceId });
  for (const o of closed) {
    await clearNotifications(o.practiceId, "patient_offer", o.id).catch(() => undefined);
    await clearNotifications(o.practiceId, "offer_accepted", o.id).catch(() => undefined);
    await clearNotifications(o.practiceId, "offer_declined", o.id).catch(() => undefined);
  }
  return closed.length;
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

/** Open offers with how many clinicians accepted (admin Overview and the Patients menu count). */
export function waitingOffers(practiceId: string) {
  return db
    .select({
      patientId: patients.id,
      name: patients.fullName,
      service: patientOffers.service,
      offeredAt: patientOffers.offeredAt,
      accepted: sql<number>`(select count(*)::int from patient_offer_responses r where r.offer_id = ${patientOffers.id} and r.answer = 'accepted')`,
    })
    .from(patientOffers)
    .innerJoin(patients, eq(patients.id, patientOffers.patientId))
    .where(and(eq(patientOffers.practiceId, practiceId), eq(patientOffers.status, "open"), eq(patients.status, "active")))
    .orderBy(asc(patientOffers.offeredAt));
}
