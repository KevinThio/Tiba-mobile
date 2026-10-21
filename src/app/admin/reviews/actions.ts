"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications, reviews } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/**
 * Marks the practice's reviews as read once the admin has seen the list. Called from the
 * browser after the page shows, so this visit still shows which ones were new. No
 * revalidation, so the open page keeps its New badges; counts update on the next page.
 */
export async function markReviewsSeen() {
  const admin = await requireAdmin();
  await db
    .update(reviews)
    .set({ seenAt: sql`now()` })
    .where(and(eq(reviews.practiceId, admin.practiceId), isNull(reviews.seenAt)));
  // Opening the reviews deals with their notifications too.
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.recipientId, admin.id), eq(notifications.type, "review"), isNull(notifications.readAt)));
}

/**
 * Hides a review (it leaves the list and the average) or shows it again. Reviews can't be
 * deleted or edited; a database trigger (drizzle/0010_protect_reviews.sql) enforces that.
 */
export async function setReviewHidden(input: {
  reviewId: string;
  hidden: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  if (typeof input.reviewId !== "string" || typeof input.hidden !== "boolean") {
    return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  }
  const updated = await db
    .update(reviews)
    .set(
      input.hidden
        ? { hiddenAt: sql`now()`, hiddenById: admin.id, seenAt: sql`coalesce(${reviews.seenAt}, now())` }
        : { hiddenAt: null, hiddenById: null },
    )
    .where(and(eq(reviews.id, input.reviewId), eq(reviews.practiceId, admin.practiceId)))
    .returning({ id: reviews.id });
  if (!updated.length) return { ok: false, message: "We couldn't find that review. Please refresh the page." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
