import { auth } from "@/lib/auth";
import { renderPatientRecordPdf } from "@/lib/paperwork-pdf";
import { isValidTimeZone } from "@/lib/reminders";

// The patient record as a PDF, for an active clinician in the patient's practice (their own visits
// only). `?tz=` is the viewer's time zone (not patient data). The file name carries no patient data.
export async function GET(request: Request, { params }: RouteContext<"/api/patients/[id]/pdf">) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user as { id: string; name: string; role?: unknown; status?: unknown; practiceId?: unknown } | undefined;
  if (!user || user.role !== "clinician" || user.status !== "active" || typeof user.practiceId !== "string") {
    return new Response(null, { status: 404 });
  }
  const { id } = await params;
  const tz = new URL(request.url).searchParams.get("tz");
  const zone = tz && tz.length <= 64 && isValidTimeZone(tz) ? tz : "UTC";
  const result = await renderPatientRecordPdf(id, { id: user.id, name: user.name, practiceId: user.practiceId }, zone);
  if (!result) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="patient-record.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
