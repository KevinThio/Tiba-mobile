"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { noteBillings } from "@/db/schema";
import { signedNotesInPractice } from "@/lib/admin-billing";
import { requireAdmin } from "@/lib/auth";

/**
 * Mark as billed (spec v2 Completed notes and Insurance billing): records that signed notes have
 * been billed to insurance. Billing is kept apart from the locked note itself.
 */
export async function markNotesBilled(input: { appointmentIds: string[] }): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  const parsed = z.object({ appointmentIds: z.array(z.uuid()).min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  const found = await signedNotesInPractice(parsed.data.appointmentIds, admin.practiceId);
  if (!found.length) return { ok: false, message: "We couldn't find those signed notes. Please refresh the page." };
  await db
    .insert(noteBillings)
    .values(found.map((n) => ({ noteId: n.noteId, billedById: admin.id })))
    .onConflictDoNothing();
  revalidatePath("/admin", "layout");
  return { ok: true, count: found.length };
}
