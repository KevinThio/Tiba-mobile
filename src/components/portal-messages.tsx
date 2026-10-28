"use client";

import { FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { sizeText } from "@/lib/format";
import { RelativeDay } from "@/components/relative-day";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ThreadAttachment = { id: string; name: string; size: number };
export type ThreadMessage = {
  id: string;
  fromPatient: boolean;
  authorName: string;
  body: string;
  createdAt: string;
  attachments?: ThreadAttachment[];
};

/**
 * A portal conversation, oldest first. `viewer` decides which side is "you": the patient or
 * referral source in their portal, the practice in the admin app. Bodies are plain text (React
 * escapes them). Attached documents open through /api/files, which checks who may see them.
 */
export function MessageThread({
  messages,
  viewer,
  practiceName,
  empty,
}: {
  messages: ThreadMessage[];
  viewer: "portal" | "practice";
  practiceName: string;
  empty: string;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (!messages.length) return <p className="rounded-md bg-muted px-4 py-6 text-center text-muted-foreground">{empty}</p>;
  return (
    <ol className="grid gap-3" aria-label="Messages">
      {messages.map((m) => {
        const mine = viewer === "portal" ? m.fromPatient : !m.fromPatient;
        // The portal sees who at the practice wrote; the practice sees the account's or admin's name.
        const who = viewer === "portal" ? (m.fromPatient ? "You" : `${m.authorName} · ${practiceName}`) : m.authorName;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("grid max-w-[85%] gap-1 rounded-lg px-4 py-3 sm:max-w-[70%]", mine ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground")}>
              <p className="text-caption font-semibold text-muted-foreground">
                {who} · <RelativeDay iso={m.createdAt} withTime />
              </p>
              <p className="break-words whitespace-pre-line">{m.body}</p>
              {!!m.attachments?.length && (
                <ul className="mt-1 grid gap-1.5" aria-label="Documents">
                  {m.attachments.map((f) => (
                    <li key={f.id}>
                      <a
                        href={`/api/files/${f.id}`}
                        target="_blank"
                        rel="noopener"
                        className="flex min-h-11 items-center gap-2 rounded-sm border border-border-subtle bg-card px-3 py-2 text-foreground outline-none hover:bg-sunken focus-visible:ring-3 focus-visible:ring-ring"
                      >
                        <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                        <span className="shrink-0 text-caption text-muted-foreground">{sizeText(f.size)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
      <div ref={end} />
    </ol>
  );
}

type Upload = { key: number; name: string; size: number; id?: string };
export type AttachmentConfig = { url: string; max: number; maxBytes: number };

/**
 * Documents picked for a message or referral. Each uploads as soon as it's picked (to
 * `config.url`, one per request, so each stays under Vercel's request limit); `ready` holds the ids
 * to send with it. Removing one before sending deletes the upload.
 */
export function useUploads(config?: AttachmentConfig) {
  const nextKey = useRef(0);
  const [uploads, setUploads] = useState<Upload[]>([]);

  async function add(list: FileList | null) {
    if (!config || !list) return;
    const room = config.max - uploads.length;
    const picked = Array.from(list);
    if (picked.length > room) toast.error(`You can add up to ${config.max} documents at a time.`);
    for (const file of picked.slice(0, Math.max(0, room))) {
      if (file.size > config.maxBytes) {
        toast.error(`${file.name} is bigger than ${Math.round(config.maxBytes / 1024 / 1024)} MB. Try a smaller copy, or split it.`);
        continue;
      }
      const key = nextKey.current++;
      setUploads((u) => [...u, { key, name: file.name, size: file.size }]);
      const form = new FormData();
      form.set("file", file);
      const result = await fetch(config.url, { method: "POST", body: form })
        .then((r) => r.json() as Promise<{ ok: true; id: string; name: string; size: number } | { ok: false; message: string }>)
        .catch(() => null);
      if (!result?.ok) {
        setUploads((u) => u.filter((x) => x.key !== key));
        toast.error(result?.message ?? `We couldn't upload ${file.name}. Check your connection and try again.`);
        continue;
      }
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, id: result.id, name: result.name, size: result.size } : x)));
    }
  }

  function remove(upload: Upload) {
    setUploads((u) => u.filter((x) => x.key !== upload.key));
    if (config && upload.id) fetch(`${config.url}?id=${upload.id}`, { method: "DELETE" }).catch(() => undefined);
  }

  return {
    config,
    uploads,
    add,
    remove,
    reset: () => setUploads([]),
    uploading: uploads.some((u) => !u.id),
    ready: uploads.filter((u) => u.id).map((u) => u.id!),
  };
}

type Uploads = ReturnType<typeof useUploads>;

/** The documents being uploaded or ready to send, each with a Remove button. */
export function UploadList({ uploads: u, disabled }: { uploads: Uploads; disabled?: boolean }) {
  if (!u.uploads.length) return null;
  return (
    <ul className="grid gap-1.5" aria-label="Documents to send">
      {u.uploads.map((x) => (
        <li key={x.key} className="flex min-h-11 items-center gap-2 rounded-sm bg-muted px-3 py-1.5">
          {x.id ? <FileText className="size-5 shrink-0 text-primary" aria-hidden /> : <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{x.name}</span>
          <span className="shrink-0 text-caption text-muted-foreground">{x.id ? sizeText(x.size) : "Uploading…"}</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => u.remove(x)} disabled={!x.id || disabled} aria-label={`Remove ${x.name}`}>
            <X aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** "Attach documents": opens the file picker. */
export function AttachButton({ uploads: u, disabled }: { uploads: Uploads; disabled?: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  if (!u.config) return null;
  return (
    <>
      <input
        ref={picker}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          u.add(e.target.files);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" onClick={() => picker.current?.click()} disabled={disabled || u.uploads.length >= u.config.max}>
        <Paperclip aria-hidden />
        Attach documents
      </Button>
    </>
  );
}

/**
 * The box to write a message. `send` is the app's Server Action; the page refreshes after a send.
 * With `attachments`, documents can be added (see `useUploads`). A message then needs text or at
 * least one document.
 */
export function MessageComposer({
  send,
  label,
  placeholder,
  attachments,
}: {
  send: (body: string, attachmentIds: string[]) => Promise<{ ok: true } | { ok: false; message: string }>;
  label: string;
  placeholder: string;
  attachments?: AttachmentConfig;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const uploads = useUploads(attachments);
  const { ready, uploading } = uploads;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if ((!text && !ready.length) || pending || uploading) return;
    setPending(true);
    const result = await send(text, ready).catch(() => null);
    setPending(false);
    if (!result?.ok) return void toast.error(result?.message ?? "We couldn't send that. Check your connection and try again.");
    setBody("");
    uploads.reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label htmlFor="message-body" className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id="message-body"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder={placeholder}
        className="min-h-24 w-full resize-y rounded-md border-[1.5px] border-input bg-card px-3.5 py-3 text-base outline-none placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring"
      />
      <UploadList uploads={uploads} disabled={pending} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <AttachButton uploads={uploads} disabled={pending} />
          <span className="text-caption text-muted-foreground">
            {body.length > 1800 ? `${2000 - body.length} characters left` : attachments ? `PDF, Word or images, up to ${Math.round(attachments.maxBytes / 1024 / 1024)} MB each` : ""}
          </span>
        </div>
        <Button type="submit" disabled={pending || uploading || (!body.trim() && !ready.length)}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          Send
        </Button>
      </div>
    </form>
  );
}

/** Marks the other side's messages read once the conversation is on screen, and checks for new ones every 30 s. */
export function ThreadUpkeep({ markRead, hasUnread }: { markRead: () => Promise<unknown>; hasUnread: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (hasUnread) markRead().then(() => router.refresh(), () => undefined);
  }, [hasUnread, markRead, router]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
