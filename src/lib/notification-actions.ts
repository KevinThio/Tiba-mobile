"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireAccount } from "@/lib/auth";

/** Marks one of your notifications read (when it's opened). */
export async function markNotificationRead(id: string) {
  const account = await requireAccount();
  if (!z.uuid().safeParse(id).success) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, account.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}

/** "Mark all as read". */
export async function markAllNotificationsRead() {
  const account = await requireAccount();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientId, account.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}
