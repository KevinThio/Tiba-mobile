import "server-only";

type SessionUser = { id: string; role?: unknown; status?: unknown; practiceId?: unknown };

/**
 * Who may download which PDFs: an active clinician their own notes and invoices; the practice
 * admin every one in the practice (Completed notes, Invoices). Anyone else gets nothing.
 */
export function pdfScope(user: SessionUser): { clinicianId: string } | { practiceId: string } | null {
  if (user.role === "admin" && typeof user.practiceId === "string") return { practiceId: user.practiceId };
  if (user.role === "clinician" && user.status === "active") return { clinicianId: user.id };
  return null;
}
