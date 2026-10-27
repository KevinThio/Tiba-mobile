"use client";

import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RelativeDay } from "@/components/relative-day";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ThreadMessage = { id: string; fromPatient: boolean; authorName: string; body: string; createdAt: string };

/**
 * A patient portal conversation, oldest first. `viewer` decides which side is "you": the patient
 * in the portal, the practice in the admin app. Bodies are plain text (React escapes them).
 */
export function MessageThread({
  messages,
  viewer,
  practiceName,
  empty,
}: {
  messages: ThreadMessage[];
  viewer: "patient" | "practice";
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
        const mine = viewer === "patient" ? m.fromPatient : !m.fromPatient;
        // The patient sees who at the practice wrote; the practice sees the patient's or admin's name.
        const who = viewer === "patient" ? (m.fromPatient ? "You" : `${m.authorName} · ${practiceName}`) : m.authorName;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("grid max-w-[85%] gap-1 rounded-lg px-4 py-3 sm:max-w-[70%]", mine ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground")}>
              <p className="text-caption font-semibold text-muted-foreground">
                {who} · <RelativeDay iso={m.createdAt} withTime />
              </p>
              <p className="break-words whitespace-pre-line">{m.body}</p>
            </div>
          </li>
        );
      })}
      <div ref={end} />
    </ol>
  );
}

/** The box to write a message. `send` is the app's Server Action; the page refreshes after a send. */
export function MessageComposer({
  send,
  label,
  placeholder,
}: {
  send: (body: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  label: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    setPending(true);
    const result = await send(text).catch(() => null);
    setPending(false);
    if (!result?.ok) return void toast.error(result?.message ?? "We couldn't send that. Check your connection and try again.");
    setBody("");
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-muted-foreground">{body.length > 1800 ? `${2000 - body.length} characters left` : ""}</span>
        <Button type="submit" disabled={pending || !body.trim()}>
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
