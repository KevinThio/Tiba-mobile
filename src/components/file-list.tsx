"use client";

import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FileItem = { id: string; slot: string | null; name: string; description: string | null; size: number; createdAt: string };
type Owner = { ownerKind: "clinician" | "clinician_admin" | "patient" | "location"; ownerId: string };

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const sizeText = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const ACCEPT_ANY = ".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

async function upload(file: File, owner: Owner, extra: { slot?: string; description?: string }) {
  const body = new FormData();
  body.set("file", file);
  body.set("ownerKind", owner.ownerKind);
  body.set("ownerId", owner.ownerId);
  if (extra.slot) body.set("slot", extra.slot);
  if (extra.description) body.set("description", extra.description);
  const response = await fetch("/api/files", { method: "POST", body }).catch(() => null);
  const result = (await response?.json().catch(() => null)) as { ok: boolean; message?: string } | null;
  if (!result?.ok) throw new Error(result?.message ?? "We couldn't upload that just now. Check your connection and try again.");
}

async function remove(id: string) {
  const response = await fetch(`/api/files/${id}`, { method: "DELETE" }).catch(() => null);
  const result = (await response?.json().catch(() => null)) as { ok: boolean; message?: string } | null;
  if (!result?.ok) throw new Error(result?.message ?? "We couldn't remove that just now. Please try again.");
}

function FileRow({ file, canRemove, onRemoved }: { file: FileItem; canRemove: boolean; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle py-3 last:border-b-0">
      <FileText className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{file.description || file.name}</p>
        <p className="truncate text-small text-muted-foreground">
          {file.description ? `${file.name} · ` : ""}
          {sizeText(file.size)} · {DATE.format(new Date(file.createdAt))}
        </p>
      </div>
      <Button variant="ghost" size="sm" nativeButton={false} render={<a href={`/api/files/${file.id}`} target="_blank" rel="noopener" />}>
        <Download aria-hidden /> Download
      </Button>
      {canRemove && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(`Remove ${file.description || file.name}? This can't be undone.`)) return;
            setBusy(true);
            try {
              await remove(file.id);
              toast.success("File removed.");
              onRemoved();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />} Remove
        </Button>
      )}
    </li>
  );
}

/**
 * A list of files with an upload box (spec v2 "Documents and files"): every file shows its name,
 * description, size and upload date, and can be downloaded or removed.
 */
export function FileList({
  owner,
  files,
  canUpload,
  canRemove,
  pdfOnly = false,
  requireDescription = false,
  hint,
  emptyText,
}: {
  owner: Owner;
  files: FileItem[];
  canUpload: boolean;
  canRemove: boolean;
  pdfOnly?: boolean;
  requireDescription?: boolean;
  hint: string;
  emptyText: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `${owner.ownerKind}-desc`;

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await upload(file, owner, { description: description.trim() });
      setDescription("");
      toast.success(`${file.name} is uploaded.`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-small text-muted-foreground">{hint}</p>
      {files.length ? (
        <ul className="grid">
          {files.map((f) => (
            <FileRow key={f.id} file={f} canRemove={canRemove} onRemoved={() => router.refresh()} />
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed px-4 py-4 text-center text-small text-subtle-foreground">{emptyText}</p>
      )}
      {canUpload && (
        <div className="grid gap-2 border-t border-border-subtle pt-3">
          <Label htmlFor={id}>{requireDescription ? "Short description" : "Description (optional)"}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={id}
              value={description}
              maxLength={200}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError(null);
              }}
              placeholder={requireDescription ? "e.g. Fire safety certificate 2026" : "e.g. Referral letter from Dr Otieno"}
            />
            <input
              ref={input}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              accept={pdfOnly ? ".pdf,application/pdf" : ACCEPT_ANY}
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={busy}
              onClick={() => {
                if (requireDescription && !description.trim()) return setError("Add a short description first.");
                input.current?.click();
              }}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
              {pdfOnly ? "Upload PDF" : "Upload file"}
            </Button>
          </div>
          {error && <FormAlert>{error}</FormAlert>}
        </div>
      )}
    </div>
  );
}

/** One named document (Resume or CV, W-9): upload, replace, download, remove. */
export function FileSlot({
  owner,
  slot,
  label,
  file,
  editable,
}: {
  owner: Owner;
  slot: string;
  label: string;
  file: FileItem | null;
  editable: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      await upload(f, owner, { slot });
      toast.success(`${label} is uploaded.`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border-subtle px-4 py-3")}>
      <FileText className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className="truncate text-small text-muted-foreground">
          {file ? `${file.name} · ${sizeText(file.size)} · ${DATE.format(new Date(file.createdAt))}` : "Not uploaded"}
        </p>
      </div>
      {file && (
        <Button variant="ghost" size="sm" nativeButton={false} render={<a href={`/api/files/${file.id}`} target="_blank" rel="noopener" />}>
          <Download aria-hidden /> Download
        </Button>
      )}
      {editable && (
        <>
          <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-hidden accept={ACCEPT_ANY} onChange={(e) => pick(e.target.files?.[0])} />
          <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {file ? "Replace" : "Upload"}
          </Button>
          {file && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm(`Remove your ${label.toLowerCase()}?`)) return;
                setBusy(true);
                try {
                  await remove(file.id);
                  toast.success(`${label} removed.`);
                  router.refresh();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          )}
        </>
      )}
    </div>
  );
}
