import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { auth } from "@/lib/auth";
import { parseLogoDataUrl } from "@/lib/practice-logo";

// Serves the signed-in clinician's practice logo. Private: only they can fetch it.
// Callers add ?v=<updatedAt> (see practiceLogoUrl), so the browser can cache it safely.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const [row] = await db
    .select({ logo: clinicians.practiceLogo })
    .from(clinicians)
    .where(eq(clinicians.id, session.user.id));
  const image = row?.logo ? parseLogoDataUrl(row.logo) : null;
  if (!image) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
