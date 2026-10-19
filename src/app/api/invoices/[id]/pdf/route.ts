import { z } from "zod";
import { auth } from "@/lib/auth";
import { invoiceNumberLabel, renderInvoicePdf } from "@/lib/invoice-pdf";

// The signed-in clinician's invoice as a PDF. Opens in the browser; Save/Print from there.
export async function GET(request: Request, { params }: RouteContext<"/api/invoices/[id]/pdf">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });

  const result = await renderInvoicePdf(id, session.user.id);
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
