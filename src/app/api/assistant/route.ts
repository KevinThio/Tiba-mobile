import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { assistantSystemPrompt, type AssistantAudience } from "@/lib/assistant/guide";
import { auth } from "@/lib/auth";
import { allow, clientIp } from "@/lib/rate-limit";

// "Ask Tiba": the help assistant on the sign-in page and in both apps (POST, streams plain text).
// It answers from Tiba's help guide only, using Google Gemini: no tools, no patient data,
// nothing stored or logged.
// Who's asking (public, clinician or admin) comes from the session, never from the request.
// Public: excluded in proxy.ts so the sign-in page can use it; rate-limited per IP.

// Google's fastest current model (Oct 2026). GEMINI_MODEL swaps it without a code change when
// Google retires it.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/** Gemini stopped because of its safety or policy checks: say so plainly. */
const STOPPED_FOR_SAFETY = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20)
    // A conversation alternates, starting and ending with the person's question.
    .refine((m) => m.every((x, i) => x.role === (i % 2 === 0 ? "user" : "assistant")) && m.length % 2 === 1),
});

let client: GoogleGenAI | null = null;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** Only Tiba's own pages may call this (a browser on another site can't spend the practice's credits). */
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const self = new URL(request.url).origin;
  const allowed = [self, appUrl()].filter(Boolean);
  if (process.env.NODE_ENV === "development") return true; // localhost, 127.0.0.1, the phone on the Wi-Fi
  return allowed.includes(origin);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return text("Ask Tiba only works from Tiba's own pages.", 403);

  // A help guide shouldn't go down with the database: if the session can't be read, answer as
  // the public guide.
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  const user = session?.user as { id: string; role?: string; status?: string } | undefined;
  const audience: AssistantAudience =
    user?.role === "admin" ? "admin" : user?.role === "clinician" && user.status === "active" ? "clinician" : "public";

  // Signed-in people get more room than the public sign-in page.
  const key = user ? `assistant:account:${user.id}` : `assistant:ip:${await clientIp()}`;
  if (!allow(key, user ? 60 : 15, 10 * 60)) {
    return text("You've asked a lot of questions in a short time. Please wait a few minutes and try again.", 429);
  }

  // The key comes from the environment: .env.local, or the host settings in production.
  if (!process.env.GEMINI_API_KEY) {
    return text(
      process.env.NODE_ENV === "development"
        ? "Ask Tiba needs a Gemini key: add GEMINI_API_KEY to .env.local, then restart npm run dev."
        : "Ask Tiba isn't set up yet. Ask your admin to add the assistant's key.",
      503,
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return text("Please type your question again (up to 2,000 characters).", 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const say = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        const reply = await gemini().models.generateContentStream({
          model: MODEL,
          contents: parsed.data.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          config: {
            // The guide is the same for every question of an audience.
            systemInstruction: assistantSystemPrompt(audience),
            maxOutputTokens: 2000,
            // Help answers are short chat: as little thinking as the model allows keeps them quick.
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            // Stop paying for an answer the person stopped or closed.
            abortSignal: request.signal,
          },
        });
        let finish: FinishReason | undefined;
        let blocked = false;
        for await (const chunk of reply) {
          if (chunk.text) say(chunk.text);
          finish = chunk.candidates?.[0]?.finishReason ?? finish;
          if (chunk.promptFeedback?.blockReason) blocked = true;
        }
        if (blocked || (finish && STOPPED_FOR_SAFETY.has(finish))) {
          say("\n\nSorry, I can't help with that one. Try asking about how to use Tiba.");
        } else if (finish === FinishReason.MAX_TOKENS) say("…");
      } catch (error) {
        if (request.signal.aborted) return;
        // Never log the question or answer: they can contain patient details someone typed.
        console.error("Ask Tiba failed:", error instanceof ApiError ? `${error.status} ${error.name}` : "unexpected error");
        const status = error instanceof ApiError ? error.status : 0;
        say(
          status === 400 || status === 401 || status === 403
            ? "Ask Tiba isn't set up yet. Ask your admin to check the assistant's key."
            : status === 429
              ? "Ask Tiba is busy right now. Please try again in a minute."
              : "Sorry, something went wrong on our side. Please try again.",
        );
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed because the person left.
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
