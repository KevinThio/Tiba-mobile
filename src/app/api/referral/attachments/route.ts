import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { files } from "@/db/schema";
import { auth } from "@/lib/auth";
import { cleanFileName, sniffType } from "@/lib/files";
import { ATTACHMENT_MAX_BYTES, draftOwner } from "@/lib/portal";
import { allow } from "@/lib/rate-limit";

// Referral portal documents. One file per request (multipart "file"), so each stays under
// Vercel's 4.5 MB request limit. The file waits as a draft of the account ("draft:<id>") until
// sendReferralMessage attaches it to the message; drafts left behind are cleared after a day.

const MAX_DRAFTS = 10;
const TOO_BIG = "That file is bigger than 4 MB. Try a smaller copy, or split it.";

async function referrer(request: Request) {
  // Same-origin only (the session cookie is SameSite=Lax, and this checks it too).
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return null;
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;
  if (!user || user.role !== "referrer" || user.status !== "active" || typeof user.practiceId !== "string") return null;
  return { id: user.id, practiceId: user.practiceId };
}

/** Upload one document for the message being written. */
export async function POST(request: Request) {
  const account = await referrer(request);
  if (!account) return json(403, "Please sign in again.");
  if (Number(request.headers.get("content-length") ?? 0) > ATTACHMENT_MAX_BYTES + 64_000) return json(413, TOO_BIG);
  if (!allow(`referral-upload:${account.id}`, 40, 10 * 60)) return json(429, "You've uploaded a lot of files in a short time. Please wait a few minutes.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, "We couldn't read that upload. Please try again.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return json(400, "Choose a file to upload.");
  if (file.size > ATTACHMENT_MAX_BYTES) return json(413, TOO_BIG);

  const [waiting] = await db
    .select({ n: count() })
    .from(files)
    .where(and(eq(files.ownerKind, "message"), eq(files.ownerId, draftOwner(account.id))));
  if (Number(waiting?.n ?? 0) >= MAX_DRAFTS) return json(400, "Send your message first, then add more documents.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes, "message");
  if (!type) return json(415, "Upload a PDF, Word document or image (PNG or JPG).");

  const [saved] = await db
    .insert(files)
    .values({
      practiceId: account.practiceId,
      ownerKind: "message",
      ownerId: draftOwner(account.id),
      name: cleanFileName(file.name, type.ext),
      mimeType: type.mime,
      size: bytes.length,
      data: bytes,
      uploadedById: account.id,
    })
    .returning({ id: files.id, name: files.name, size: files.size });
  return Response.json({ ok: true, ...saved });
}

/** Remove a document before the message is sent (sent documents stay with the message). */
export async function DELETE(request: Request) {
  const account = await referrer(request);
  if (!account) return json(403, "Please sign in again.");
  const id = new URL(request.url).searchParams.get("id");
  if (!z.uuid().safeParse(id).success) return json(400, "Something went wrong. Please refresh the page.");
  await db
    .delete(files)
    .where(and(eq(files.id, id!), eq(files.ownerKind, "message"), eq(files.ownerId, draftOwner(account.id))));
  return Response.json({ ok: true });
}

function json(status: number, message: string) {
  return Response.json({ ok: false, message }, { status });
}
