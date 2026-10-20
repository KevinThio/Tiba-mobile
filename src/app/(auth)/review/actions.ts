"use server";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clinicians, practices, reviews } from "@/db/schema";
import { normalisePracticeName } from "@/lib/practice-name";
import { allow, clientIp } from "@/lib/rate-limit";

// Public: patients leave reviews without an account (spec v2 section 6). Only the
// practice name and its active clinicians' names are ever shown here.

export type ReviewPractice = {
  id: string;
  name: string;
  clinicians: { id: string; name: string }[];
};

type Found = { ok: true; practice: ReviewPractice } | { ok: false; message: string };

const SLOW_DOWN = "You've tried a lot of times. Please wait a few minutes and try again.";

async function practiceById(id: string): Promise<ReviewPractice | null> {
  const [practice] = await db
    .select({ id: practices.id, name: practices.name })
    .from(practices)
    .where(eq(practices.id, id));
  if (!practice) return null;
  const team = await db
    .select({ id: clinicians.id, name: clinicians.name, role: clinicians.role })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, id), eq(clinicians.status, "active")))
    .orderBy(asc(clinicians.name));
  // A practice can only take reviews if it has an admin to read them.
  if (!team.some((m) => m.role === "admin")) return null;
  return { ...practice, clinicians: team.filter((m) => m.role === "clinician").map(({ id, name }) => ({ id, name })) };
}

/** Finds a practice by the name the patient types (same matching as clinicians joining). */
export async function findPracticeForReview(input: { name: string }): Promise<Found> {
  if (!allow(`review-find:${await clientIp()}`, 30, 600)) return { ok: false, message: SLOW_DOWN };
  const name = String(input.name ?? "").trim();
  if (!name) return { ok: false, message: "Type the name of the practice you visited." };
  const [row] = await db
    .select({ id: practices.id })
    .from(practices)
    .where(eq(practices.nameKey, normalisePracticeName(name)));
  const practice = row ? await practiceById(row.id) : null;
  if (!practice) {
    return {
      ok: false,
      message: `We couldn't find "${name}" on Tiba. Check the name on your appointment letter or invoice, or ask the practice for their review link.`,
    };
  }
  return { ok: true, practice };
}

/** Loads the practice from a shared review link (/review?practice=…). */
export async function practiceFromLink(id: string): Promise<ReviewPractice | null> {
  if (!z.uuid().safeParse(id).success) return null;
  return practiceById(id);
}

const reviewInput = z.object({
  practiceId: z.uuid(),
  clinicianId: z.string().optional(),
  rating: z.number().int().min(1, "Pick a star rating.").max(5),
  text: z.string().trim().min(1, "Write a few words about your visit.").max(2000, "Please keep your review under 2,000 characters."),
  name: z.string().trim().max(100).optional(),
  // Honeypot: hidden from people, often filled in by bots.
  website: z.string().optional(),
});

export async function submitReview(
  input: z.input<typeof reviewInput>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = reviewInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your review." };
  const { practiceId, clinicianId, rating, text, name, website } = parsed.data;
  if (website) return { ok: true }; // Quietly drop bot submissions.
  if (!allow(`review-send:${await clientIp()}`, 5, 600)) return { ok: false, message: SLOW_DOWN };

  const practice = await practiceById(practiceId);
  if (!practice) return { ok: false, message: "That practice isn't taking reviews on Tiba. Please check the name." };
  const seen = clinicianId && practice.clinicians.some((c) => c.id === clinicianId) ? clinicianId : null;

  await db.insert(reviews).values({ practiceId, clinicianId: seen, rating, text, name: name || null });
  return { ok: true };
}
