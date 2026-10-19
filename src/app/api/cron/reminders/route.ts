import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/reminders";

// Called by a scheduler (e.g. hourly) with "Authorization: Bearer <CRON_SECRET>".
// Each clinician who turned reminders on gets one email per evening; see src/lib/reminders.ts.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok =
    !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response(null, { status: 401 });

  const result = await sendDueReminders();
  return Response.json(result);
}
