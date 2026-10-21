import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { files } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canUseOwner, type Account, type OwnerKind } from "@/lib/files";

async function load(request: Request, id: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !z.uuid().safeParse(id).success) return null;
  const account = session.user as unknown as Account;
  const [file] = await db.select().from(files).where(eq(files.id, id));
  if (!file || file.practiceId !== account.practiceId) return null;
  return { account, file };
}

/** Download a file you're allowed to see. */
export async function GET(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  const found = await load(request, id);
  if (!found || !(await canUseOwner(found.account, found.file.ownerKind as OwnerKind, found.file.ownerId, "read"))) {
    return new Response(null, { status: 404 });
  }
  const { file } = found;
  const inline = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

/** Remove a file you're allowed to change (an admin can't remove a clinician's own Profile documents). */
export async function DELETE(request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return new Response(null, { status: 403 });
  const { id } = await params;
  const found = await load(request, id);
  if (!found || !(await canUseOwner(found.account, found.file.ownerKind as OwnerKind, found.file.ownerId, "write"))) {
    return Response.json({ ok: false, message: "You can't remove this file." }, { status: 403 });
  }
  await db.delete(files).where(eq(files.id, id));
  return Response.json({ ok: true });
}
