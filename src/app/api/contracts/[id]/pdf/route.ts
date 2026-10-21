import { auth } from "@/lib/auth";
import { renderContractPdf } from "@/lib/contract-pdf";
import { pdfScope } from "@/lib/pdf-scope";

// A signed contract as a PDF: the clinician's own, or any in the practice for its admin.
export async function GET(request: Request, { params }: RouteContext<"/api/contracts/[id]/pdf">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const scope = pdfScope(session.user);
  if (!scope) return new Response(null, { status: 403 });
  const { id } = await params;
  const result = await renderContractPdf(id, scope);
  if (!result) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contract-${result.label}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
