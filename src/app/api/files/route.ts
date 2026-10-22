import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canUseOwner, cleanFileName, MAX_FILE_BYTES, sniffType, type Account, type OwnerKind } from "@/lib/files";
import { PROFILE_DOC_SLOTS } from "@/lib/profiles";

const KINDS: OwnerKind[] = ["clinician", "clinician_admin", "patient", "location"];
const SLOTS = PROFILE_DOC_SLOTS;

/**
 * Upload a file (multipart: file, ownerKind, ownerId, slot?, description?). A route rather than a
 * Server Action so uploads can be up to 5 MB without raising every action's body limit.
 */
export async function POST(request: Request) {
  // Same-origin only (the session cookie is SameSite=Lax, and this checks it too).
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, "That upload came from another site.");

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return json(401, "Please sign in again.");
  const account = session.user as unknown as Account;
  if (typeof account.practiceId !== "string") return json(403, "Please sign in again.");

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES + 64_000) return json(413, "That file is bigger than 5 MB. Try a smaller copy.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, "We couldn't read that upload. Please try again.");
  }
  const file = form.get("file");
  const kind = String(form.get("ownerKind") ?? "") as OwnerKind;
  const ownerId = String(form.get("ownerId") ?? "");
  const slot = form.get("slot") ? String(form.get("slot")) : null;
  const description = String(form.get("description") ?? "").trim().slice(0, 200) || null;

  if (!(file instanceof File) || file.size === 0) return json(400, "Choose a file to upload.");
  if (file.size > MAX_FILE_BYTES) return json(413, "That file is bigger than 5 MB. Try a smaller copy.");
  if (!KINDS.includes(kind) || !ownerId) return json(400, "Something went wrong. Please refresh the page and try again.");
  if (slot !== null && (kind !== "clinician" || !SLOTS.includes(slot))) return json(400, "Something went wrong. Please refresh the page.");
  if (kind === "location" && !description) return json(400, "Add a short description first.");
  // A clinician's other documents (no slot) each need a short description, so the admin knows what it is.
  if (kind === "clinician" && !slot && !description) return json(400, "Add a short description first.");
  if (!(await canUseOwner(account, kind, ownerId, "write"))) return json(403, "You can't add files here.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes, kind);
  if (!type) {
    return json(415, kind === "location" ? "Locations take PDF files only." : "Upload a PDF, Word document or image (PNG or JPG).");
  }

  const [saved] = await db.transaction(async (tx) => {
    // A Profile slot (ID, resume, job description, W-9) holds one file: uploading again replaces it.
    if (slot) await tx.delete(files).where(and(eq(files.ownerKind, kind), eq(files.ownerId, ownerId), eq(files.slot, slot)));
    return tx
      .insert(files)
      .values({
        practiceId: account.practiceId,
        ownerKind: kind,
        ownerId,
        slot,
        name: cleanFileName(file.name, type.ext),
        description,
        mimeType: type.mime,
        size: bytes.length,
        data: bytes,
        uploadedById: account.id,
      })
      .returning({ id: files.id, name: files.name });
  });
  return Response.json({ ok: true, id: saved.id, name: saved.name });
}

function json(status: number, message: string) {
  return Response.json({ ok: false, message }, { status });
}
