"use client";

import { ArrowUp, Loader2, MessageCircleQuestion, RotateCcw, Square, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STARTERS, type AssistantAudience } from "@/lib/assistant/starters";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string };

/**
 * "Ask Tiba": a floating help button that opens a chat with Tiba's help guide (/api/assistant).
 * The server decides what the assistant knows from the session; `audience` only picks the starter
 * questions and where the button sits (`withTabBar` lifts it above the phone tab bar). The chat
 * lives in memory only: nothing is saved, and people are asked not to type patient details.
 * It steps aside on the signing page (the patient holds the device there) and rises above any
 * screen action bar marked `data-action-bar`.
 */
export function AssistantWidget({ audience, withTabBar = false }: { audience: AssistantAudience; withTabBar?: boolean }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const signing = /^\/appointments\/[^/]+\/sign/.test(usePathname() ?? "");

  // Keep the newest words in view while an answer streams in.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [turns]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Turn[] = [...turns, { role: "user", content: q.slice(0, 2000) }];
    // Send at most the last 19 turns (the server takes 20 and needs an odd count ending with a question).
    const sent = history.slice(-19);
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    const append = (chunk: string) =>
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + chunk };
        return next;
      });
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: sent }),
        signal: controller.signal,
      });
      if (!response.body) throw new Error("no body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        append(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") append("Sorry, I couldn't reach Ask Tiba. Check your connection and try again.");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  function stop() {
    abort.current?.abort();
  }

  function reset() {
    stop();
    setTurns([]);
    setDraft("");
    input.current?.focus();
  }

  if (signing) return null;

  const lift = withTabBar
    ? "bottom-[calc(72px+env(safe-area-inset-bottom)+16px)] md:bottom-6 [body:has([data-action-bar])_&]:bottom-[calc(188px+env(safe-area-inset-bottom))] md:[body:has([data-action-bar])_&]:bottom-28"
    : "bottom-[calc(env(safe-area-inset-bottom)+20px)]";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed right-5 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-lg transition-colors duration-120 ease-out outline-none hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring md:right-8",
            lift,
          )}
        >
          <MessageCircleQuestion className="size-5" aria-hidden />
          Ask Tiba
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Ask Tiba"
          className={cn(
            "fixed inset-x-0 z-50 flex flex-col bg-card shadow-lg",
            // Phones: a sheet over most of the screen. Larger screens: a panel in the corner.
            "top-[calc(env(safe-area-inset-top)+48px)] bottom-0 rounded-t-xl border-t border-border-subtle",
            "sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 sm:h-[min(640px,calc(100dvh-48px))] sm:w-[400px] sm:rounded-xl sm:border",
          )}
        >
          <header className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <MessageCircleQuestion className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-h3 leading-tight">Ask Tiba</h2>
              <p className="text-caption text-muted-foreground">Help with using Tiba</p>
            </div>
            {turns.length > 0 && (
              <button
                type="button"
                onClick={reset}
                aria-label="Start a new chat"
                className="flex size-10 items-center justify-center rounded-full text-primary outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
              >
                <RotateCcw className="size-5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Ask Tiba"
              className="flex size-10 items-center justify-center rounded-full text-primary outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>

          <div ref={list} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {turns.length === 0 ? (
              <div className="grid gap-3">
                <p className="text-muted-foreground">
                  Hi! Ask me how to do something in Tiba, and I&apos;ll walk you through it.
                </p>
                <div className="flex flex-wrap gap-2">
                  {STARTERS[audience].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => ask(q)}
                      className="min-h-11 rounded-full border-[1.5px] border-input bg-card px-4 text-left text-small font-semibold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ol className="grid gap-3">
                {turns.map((t, i) => (
                  <li key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-4 py-2.5 break-words",
                        t.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      {t.role === "assistant" && !t.content && busy ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Thinking" />
                      ) : (
                        <FormattedAnswer text={t.content} />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
            className="grid gap-2 border-t border-border-subtle px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:pb-3"
          >
            <div className="flex items-end gap-2">
              <label htmlFor="ask-tiba-input" className="sr-only">
                Your question
              </label>
              <textarea
                id="ask-tiba-input"
                ref={input}
                rows={1}
                maxLength={2000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(draft);
                  }
                }}
                placeholder="Ask a question"
                className="max-h-32 min-h-12 flex-1 resize-none rounded-md border-[1.5px] border-input bg-card px-3.5 py-3 text-base outline-none placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Stop the answer"
                  className="flex size-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border-action bg-card text-primary outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <Square className="size-4 fill-current" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={!draft.trim()}
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring disabled:bg-disabled disabled:text-disabled-foreground"
                >
                  <ArrowUp className="size-5" aria-hidden />
                </button>
              )}
            </div>
            <p className="text-caption text-muted-foreground">
              Answers come from AI and can be wrong. Don&apos;t type patient names or health details.
            </p>
          </form>
        </section>
      )}
    </>
  );
}

/** Plain text with the little formatting the assistant uses: paragraphs, numbered and bulleted lists, **bold**. */
function FormattedAnswer({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="grid gap-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const numbered = lines.every((l) => /^\s*\d+[.)]\s/.test(l));
        const bulleted = lines.every((l) => /^\s*[-*•]\s/.test(l));
        if (numbered || bulleted) {
          const Tag = numbered ? "ol" : "ul";
          return (
            <Tag key={i} className={cn("grid gap-1 pl-5", numbered ? "list-decimal" : "list-disc")}>
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.replace(/^\s*(\d+[.)]|[-*•])\s/, "")} />
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            <Inline text={block} />
          </p>
        );
      })}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  // **bold** only; everything else stays plain text (React escapes it, so nothing can inject markup).
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
