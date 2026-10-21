import { z } from "zod";
import { auth } from "@/lib/auth";
import { invoiceNumberLabel, renderInvoicePdf } from "@/lib/invoice-pdf";
import { pdfScope } from "@/lib/pdf-scope";

// An invoice as a PDF: the clinician's own, or any in the practice for its admin. Opens in the browser; Save/Print from there.
export async function GET(request: Request, { params }: RouteContext<"/api/invoices/[id]/pdf">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });

  const scope = pdfScope(session.user);
  if (!scope) return new Response(null, { status: 403 });
  const result = await renderInvoicePdf(id, scope);
  if (!result) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoiceNumberLabel(result.data.number)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
