"use client";

import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ThreadMessage = { id: string; fromRole: "admin" | "clinician"; body: string; createdAt: string; author: string | null };

const STAMP = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * One message thread per contract (spec v2 section 5c). Each new message notifies the other side.
 * `me` is the viewer's side, so their own messages sit on the right.
 */
export function ContractThread({
  contractId,
  me,
  messages,
  send,
  intro,
  placeholder,
  buttonLabel,
}: {
  contractId: string;
  me: "admin" | "clinician";
  messages: ThreadMessage[];
  send: ((input: { contractId: string; body: string }) => Promise<{ ok: boolean; message?: string }>) | null;
  intro: string;
  placeholder: string;
  buttonLabel: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!send) return;
    if (!body.trim()) return setError("Write your message first.");
    setBusy(true);
    setError(null);
    const result = await send({ contractId, body }).catch(() => null);
    setBusy(false);
    if (!result?.ok) return setError(result?.message ?? "We couldn't send that. Check your connection and try again.");
    setBody("");
    toast.success("Message sent.");
    router.refresh();
  }

  return (
    <section aria-labelledby="messages-heading" className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
      <div>
        <h2 id="messages-heading" className="text-h3">
          Messages
        </h2>
        <p className="text-small text-muted-foreground">{intro}</p>
      </div>
      {messages.length > 0 && (
        <ol className="grid gap-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "grid max-w-[85%] gap-1 rounded-md px-4 py-3",
                m.fromRole === me ? "justify-self-end bg-secondary" : "justify-self-start bg-muted",
              )}
            >
              <p className="text-caption text-muted-foreground">
                {m.fromRole === me ? "You" : (m.author ?? (m.fromRole === "admin" ? "Your admin" : "Clinician"))} ·{" "}
                {STAMP.format(new Date(m.createdAt))}
              </p>
              <p className="break-words whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
      {send && (
        <form onSubmit={submit} className="grid gap-2">
          <Label htmlFor="thread-body" className="sr-only">
            Your message
          </Label>
          <Textarea
            id="thread-body"
            rows={3}
            maxLength={2000}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
          />
          {error && <FormAlert>{error}</FormAlert>}
          <Button type="submit" variant="outline" className="w-fit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {buttonLabel}
          </Button>
        </form>
      )}
    </section>
  );
}
