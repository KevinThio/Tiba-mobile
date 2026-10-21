import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, files, locations, patients } from "@/db/schema";

// Uploaded files (spec v2 "Documents and files"). Kept in the database until hosting is decided.
// Every upload's real type is checked from its first bytes, never trusted from the browser.

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type OwnerKind = "clinician" | "clinician_admin" | "patient" | "location";
export type Account = { id: string; role: unknown; status?: unknown; practiceId: string };

const KINDS = {
  pdf: { mime: "application/pdf", ext: "pdf", test: (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  png: { mime: "image/png", ext: "png", test: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  jpeg: { mime: "image/jpeg", ext: "jpg", test: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  // Word: .docx is a zip; old .doc is an OLE compound file.
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
    test: (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  },
  doc: { mime: "application/msword", ext: "doc", test: (b: Uint8Array) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 },
} as const;

/** The file's real type from its bytes. Locations take PDFs only (spec v2). */
export function sniffType(bytes: Uint8Array, kind: OwnerKind) {
  const allowed = kind === "location" ? [KINDS.pdf] : Object.values(KINDS);
  return allowed.find((k) => k.test(bytes)) ?? null;
}

/** A safe file name for downloads: no paths or odd characters, keeps the extension. */
export function cleanFileName(name: string, ext: string) {
  const base = name.split(/[\\/]/).pop()!.replace(/\.[^.]*$/, "").replace(/[^\p{L}\p{N} ._()-]+/gu, " ").trim().slice(0, 100) || "file";
  return `${base}.${ext}`;
}

/**
 * Whether this account may upload to (or see) files of this owner. Clinicians: only their own
 * Profile documents. Admins: anything in their practice, except they can't add to or remove a
 * clinician's own Profile documents (they can download them).
 */
export async function canUseOwner(account: Account, kind: OwnerKind, ownerId: string, action: "read" | "write") {
  if (account.role === "clinician") {
    return account.status === "active" && kind === "clinician" && ownerId === account.id;
  }
  if (account.role !== "admin") return false;
  if (kind === "clinician" && action === "write") return false;
  if (kind === "clinician" || kind === "clinician_admin") {
    const [row] = await db
      .select({ id: clinicians.id })
      .from(clinicians)
      .where(and(eq(clinicians.id, ownerId), eq(clinicians.practiceId, account.practiceId), eq(clinicians.role, "clinician")));
    return Boolean(row);
  }
  if (kind === "patient") {
    if (!/^[0-9a-f-]{36}$/i.test(ownerId)) return false;
    const [row] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, ownerId), eq(patients.practiceId, account.practiceId), ne(patients.status, "merged")));
    return Boolean(row);
  }
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) return false;
  const [row] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, ownerId), eq(locations.practiceId, account.practiceId)));
  return Boolean(row);
}

/** File details for lists (never the bytes). */
export function listFiles(practiceId: string, kind: OwnerKind, ownerId: string) {
  return db
    .select({
      id: files.id,
      slot: files.slot,
      name: files.name,
      description: files.description,
      size: files.size,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(and(eq(files.practiceId, practiceId), eq(files.ownerKind, kind), eq(files.ownerId, ownerId)))
    .orderBy(desc(files.createdAt));
}

export type FileSummary = { id: string; slot: string | null; name: string; description: string | null; size: number; createdAt: string };

export const toSummary = (f: Awaited<ReturnType<typeof listFiles>>[number]): FileSummary => ({
  ...f,
  createdAt: f.createdAt.toISOString(),
});
