import { auth } from "@/lib/auth";
import { renderAgreementPdf } from "@/lib/paperwork-pdf";

// A fully signed service agreement as a PDF, by patient id. Admins only.
export async function GET(request: Request, { params }: RouteContext<"/api/agreements/[id]/pdf">) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user as { role?: unknown; practiceId?: unknown } | undefined;
  if (!user || user.role !== "admin" || typeof user.practiceId !== "string") return new Response(null, { status: 404 });
  const { id } = await params;
  const result = await renderAgreementPdf(id, user.practiceId);
  if (!result) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="service-agreement.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
