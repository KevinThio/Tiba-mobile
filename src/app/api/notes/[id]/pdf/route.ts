import { z } from "zod";
import { auth } from "@/lib/auth";
import { renderNotePdf } from "@/lib/note-pdf";
import { pdfScope } from "@/lib/pdf-scope";

// A signed note as a PDF, by appointment id: the clinician's own, or any in the practice for its admin. Opens in the browser;
// Save/Print from there. `?tz=` is the viewer's time zone (not patient data), so times match the screen.
export async function GET(request: Request, { params }: RouteContext<"/api/notes/[id]/pdf">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const scope = pdfScope(session.user);
  if (!scope) return new Response(null, { status: 403 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });

  const tz = new URL(request.url).searchParams.get("tz");
  const result = await renderNotePdf(id, scope, tz && tz.length <= 64 ? tz : null);
  if (!result) return new Response(null, { status: 404 });

  const date = result.data.startsAt.toLocaleDateString("en-CA", { timeZone: result.timeZone });
  return new Response(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="visit-note-${date}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
