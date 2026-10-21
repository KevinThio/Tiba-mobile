import { timingSafeEqual } from "node:crypto";
import { notifyUnbilledOverdue } from "@/lib/billing-reminders";
import { sendDueReminders } from "@/lib/reminders";

// Called by a scheduler (e.g. hourly) with "Authorization: Bearer <CRON_SECRET>".
// Each clinician who turned reminders on gets one email per evening (src/lib/reminders.ts), and
// admins get a notification when notes wait 30+ days to be billed (src/lib/billing-reminders.ts).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok =
    !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response(null, { status: 401 });

  const result = await sendDueReminders();
  // Insurance billing: tell admins when notes have waited 30+ days (one unread notice at a time).
  const unbilled = await notifyUnbilledOverdue();
  return Response.json({ ...result, unbilled });
}
