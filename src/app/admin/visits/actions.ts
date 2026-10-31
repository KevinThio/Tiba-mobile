"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { clockOutSignature, markClockNoticesRead } from "@/lib/visit-clock";

/** The patient's signature from a visit's clock-out, for the admin. */
export async function loadClockSignature(appointmentId: string): Promise<string | null> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(appointmentId).success) return null;
  return clockOutSignature(admin.practiceId, appointmentId);
}

/** Called once the visit records show: their clock notifications have been seen. */
export async function markClockNoticesSeen() {
  const admin = await requireAdmin();
  await markClockNoticesRead(admin.id);
}
